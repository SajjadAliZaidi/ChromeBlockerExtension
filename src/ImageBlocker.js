var breakLineCalled = false;
var id = 1;

function createClass(name, rules) {
    var style = document.createElement('style');
    style.type = 'text/css';
    document.getElementsByTagName('head')[0].appendChild(style);
    if (!(style.sheet || {}).insertRule)
        (style.styleSheet || style.sheet).addRule(name, rules);
    else
        style.sheet.insertRule(name + "{" + rules + "}", 0);
}


function insertBreakLineBeforeImage(image) {
    var br = document.createElement("br");
    image.parentNode.insertBefore(br, image);
}

function blockImageContent(image) {
    if (image === null) {
        return;
    }
    else {
        var div = document.createElement("div");
        console.log('obj-t:', image);
        var elementRectangle = image.getBoundingClientRect();
        console.log("Width :" + elementRectangle.width);
        createClass(".image_overlays" + id, "x: " + elementRectangle.x + ";" + "y: " + elementRectangle.y + ";" + "width: " + elementRectangle.width + "px;" +
            "height: " + elementRectangle.height + "px;" + "z-index: 300000;" + "background-color:#000000;" + "position:absolute;" + "top: " +
            elementRectangle.top + ";" + "left: " + elementRectangle.left + ";" + "right: " + elementRectangle.right + ";" + "bottom: " + elementRectangle.bottom + ";");

        div.id = "image_overlays" + id;
        div.className = "image_overlays" + id;
        image.parentNode.insertBefore(div, image);
        id++;
    }
}

// function Block() {
//   images = document.getElementsByTagName("img");
//   console.log("Hello World");
//   for(var i = 0; i < images.length; i++){
//     blockImageContent(images[i]);
//   }
// }
