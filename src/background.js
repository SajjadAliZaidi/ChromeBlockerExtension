/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import 'babel-polyfill';
import * as tf from '@tensorflow/tfjs';
import { IMAGENET_CLASSES_NEW as IMAGENET_CLASSES } from './imagenet_classes';
import { blockedSiteUrls } from './blocked_sites';

function incrementBlockedImageCount() {
    chrome.storage.sync.get(['sharam-karo-stats'], function (items) {
        console.log('Stats retrieved', items);
    });
    let blocking_stats = localStorage.getItem('sharam-karo-stats');
    if (blocking_stats) {
        blocking_stats = JSON.parse(blocking_stats);
        blocking_stats.blockedImageCount++
    } else {
        blocking_stats = {
            blockedSites: [
            ],
            blockedImageCount: 1
        };
    }
    chrome.storage.sync.set({ 'sharam-karo-stats': JSON.stringify(blocking_stats) }, function () {
        console.log('Stats saved');
    });
    localStorage.setItem('sharam-karo-stats', JSON.stringify(blocking_stats));


}

chrome.webRequest?.onBeforeSendHeaders.addListener(
    (details) => {
        chrome.storage.sync.get(['sharam-karo-stats'], function (items) {
            console.log('Stats retrieved', items);
        });
        let blocking_stats = localStorage.getItem('sharam-karo-stats');
        const url_ = details.url;
        console.log('url:', url_);
        if (blocking_stats) {
            console.log('details:', details);
            blocking_stats = JSON.parse(blocking_stats);
            const index = blocking_stats.blockedSites.findIndex(site => url_ in site);
            if (index > -1) {
                blocking_stats.blockedSites[index][url_]++;
            } else {
                blocking_stats.blockedSites.push({
                    [url_]: 1
                });
            }
        } else {
            blocking_stats = {
                blockedSites: [
                    {
                        [url_]: 1
                    }
                ],
                blockedImageCount: 0
            };
        }
        chrome.storage.sync.set({ 'sharam-karo-stats': JSON.stringify(blocking_stats) }, function () {
            console.log('Stats saved');
        });
        localStorage.setItem('sharam-karo-stats', JSON.stringify(blocking_stats));
        return { cancel: true };
    },
    { urls: blockedSiteUrls },
    ["blocking"]
);

// Code to commuicate to popup js with count of blocked websites
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'scan-image') {
        imageClassifier.analyzeImage(request.imgUrl, sender.tab.id);
    } else if (request.message === 'increase-blocked-image-count') {
        incrementBlockedImageCount();
    }
})

// Where to load the model from.
const MOBILENET_MODEL_TFHUB_URL =
    'https://ninja-cloud-functions-fbe3d.web.app/web_model_saved_graph/model.json'
// Size of the image expected by mobilenet.
const IMAGE_SIZE = 160;
// The minimum image size to consider classifying.  Below this limit the
// extension will refuse to classify the image.
const MIN_IMG_SIZE = 160;

// How many predictions to take.
const TOPK_PREDICTIONS = 1;
const FIVE_SECONDS_IN_MS = 5000;
/**
 * What action to take when someone clicks the right-click menu option.
 *  Here it takes the url of the right-clicked image and the current tabId
 *  and forwards it to the imageClassifier's analyzeImage method.
 */
function loadImageCallback(info, tab) {
    imageClassifier.analyzeImage(info.srcUrl, tab.id);
}

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.message === 'scan-image') {
//         // sendResponse({ bImages: request.images });
//         // chrome.tabs.query({ active: true, windowType: "normal", lastFocusedWindow: true }, function (tabs) {
//         //     console.log("id:", tabs[0].id);
//         //     imageClassifier.analyzeImage(request.imgUrl, tabs[0].id);
//         //     // loadImageCallback({ srcUrl: request.imgUrl }, { id: tabs[0].id });
//         // });

//         imageClassifier.analyzeImage(request.imgUrl, sender.tab.id);
//     }
// });
/**
 * Adds a right-click menu option to trigger classifying the image.
 * The menu option should only appear when right-clicking an image.
 */
chrome.contextMenus.create({
    title: 'Classify image with TensorFlow.js ',
    contexts: ['image'],
    onclick: loadImageCallback
});

// chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
//     console.log("here");
//     if (changeInfo.status == 'complete' && tab.active) {
//         let images = document.querySelectorAll('img');
//         images.forEach(image => console.log(`image: ${image}, url: ${image.srcUrl}`));
//     }
// });

/**
 * Async loads a mobilenet on construction.  Subsequently handles
 * requests to classify images through the .analyzeImage API.
 * Successful requests will post a chrome message with
 * 'IMAGE_CLICK_PROCESSED' action, which the content.js can
 * hear and use to manipulate the DOM.
 */
class ImageClassifier {
    constructor() {
        this.loadModel();
    }

    /**
     * Loads mobilenet from URL and keeps a reference to it in the object.
     */
    async loadModel() {
        console.log('Loading model...');
        const startTime = performance.now();
        try {
            this.model =
                await tf.loadGraphModel(MOBILENET_MODEL_TFHUB_URL);
            // Warms up the model by causing intermediate tensor values
            // to be built and pushed to GPU.
            tf.tidy(() => {
                this.model.predict(tf.zeros([1, IMAGE_SIZE, IMAGE_SIZE, 3]));
            });
            const totalTime = Math.floor(performance.now() - startTime);
            console.log(`Model loaded and initialized in ${totalTime} ms...`);
        } catch (e) {
            console.error(
                `Unable to load model from URL: ${MOBILENET_MODEL_TFHUB_URL}. Error: ${e}`);
        }
    }

    /**
     * Triggers the model to make a prediction on the image referenced by url.
     * After a successful prediction a IMAGE_CLICK_PROCESSED message when
     * complete, for the content.js script to hear and update the DOM with the
     * results of the prediction.
     *
     * @param {string} url url of image to analyze.
     * @param {number} tabId which tab the request comes from.
     */
    async analyzeImage(url, tabId) {
        if (!tabId) {
            console.error('No tab.  No prediction.');
            return;
        }
        if (!this.model) {
            console.log('Waiting for model to load...');
            setTimeout(() => { this.analyzeImage(url) }, FIVE_SECONDS_IN_MS);
            return;
        }
        let message;
        this.loadImage(url).then(
            async (img) => {
                if (!img) {
                    console.error(
                        'Could not load image.  Either too small or unavailable.');
                    return;
                }
                const predictions = await this.predict(img);
                console.log('img:', img);
                message = { action: 'IMAGE_CLICK_PROCESSED', url, predictions };
                if (typeof chrome.app.isInstalled !== 'undefined') {
                    chrome.tabs.sendMessage(tabId, message);
                }
            },
            (reason) => {
                console.error(`Failed to analyze: ${reason}`);
            });
    }

    /**
     * Creates a dom element and loads the image pointed to by the provided src.
     * @param {string} src URL of the image to load.
     */
    async loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous';
            img.onerror = function (e) {
                reject(`Could not load image from external source ${src}.`);
            };
            img.onload = function (e) {
                if ((img.height && img.height > MIN_IMG_SIZE) ||
                    (img.width && img.width > MIN_IMG_SIZE)) {
                    img.width = IMAGE_SIZE;
                    img.height = IMAGE_SIZE;
                    resolve(img);
                }
                // Fail out if either dimension is less than MIN_IMG_SIZE.
                reject(`Image size too small. [${img.height} x ${img.width}] vs. minimum [${MIN_IMG_SIZE} x ${MIN_IMG_SIZE}]`);
            };
            img.src = src;
        });
    }

    /**
     * Sorts predictions by score and keeps only topK
     * @param {Tensor} logits A tensor with one element per predicatable class
     *   type of mobilenet.  Return of executing model.predict on an Image.
     * @param {number} topK how many to keep.
     */
    async getTopKClasses(logits, topK) {
        const { values, indices } = tf.topk(logits, topK, true);
        console.log(`values ${values}`);
        console.log(`indices ${indices}`);
        let valuesArr = await values.data();
        // valuesArr = await tf.sigmoid(valuesArr);
        let indicesArr = await indices.data();
        // indicesArr = await tf.sigmoid(indicesArr);
        console.log(`indicesArr ${indicesArr}`);
        console.log(`valuesArr ${valuesArr}`);
        const topClassesAndProbs = [];
        topClassesAndProbs.push({
            className: valuesArr[0] > 8.25 && valuesArr[0] < 8.43 ? 'Porn' : 'Safe',
            probability: valuesArr[0]
        })

        // for (let i = 0; i <= topK; i++) {
        //     topClassesAndProbs.push({
        //         className: IMAGENET_CLASSES[indicesArr[i]],
        //         probability: valuesArr[i]
        //     })
        //     // topClassesAndProbs.push({
        //     //     className: valuesArr[i] > 1 ? 'Porn' : 'Safe',
        //     //     probability: valuesArr[i]
        //     // })
        // }
        console.log('c&p:', topClassesAndProbs);
        return topClassesAndProbs;
    }

    /**
     * Executes the model on the input image, and returns the top predicted
     * classes.
     * @param {HTMLElement} imgElement HTML element holding the image to predict
     *     from.  Should have the correct size ofr mobilenet.
     */
    async predict(imgElement) {
        console.log('Predicting...');
        // The first start time includes the time it takes to extract the image
        // from the HTML and preprocess it, in additon to the predict() call.
        const startTime1 = performance.now();
        // The second start time excludes the extraction and preprocessing and
        // includes only the predict() call.
        let startTime2;
        const logits = tf.tidy(() => {
            // Mobilenet expects images to be normalized between -1 and 1.
            const img = tf.browser.fromPixels(imgElement).toFloat();
            // const offset = tf.scalar(127.5);
            // const normalized = img.sub(offset).div(offset);
            const normalized = img.div(tf.scalar(256.0));
            const batched = normalized.reshape([1, IMAGE_SIZE, IMAGE_SIZE, 3]);
            startTime2 = performance.now();
            const output = this.model.predict(batched);
            console.log('output: ', output);
            return output;
            // throw new Error('Unexpected shape...');
        });

        // Convert logits to probabilities and class names.
        const classes = await this.getTopKClasses(logits, TOPK_PREDICTIONS);
        const totalTime1 = performance.now() - startTime1;
        const totalTime2 = performance.now() - startTime2;
        console.log(
            `Done in ${totalTime1.toFixed(1)} ms ` +
            `(not including preprocessing: ${Math.floor(totalTime2)} ms)`);
        return classes;
    }
}

const imageClassifier = new ImageClassifier();
