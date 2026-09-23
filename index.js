window.screenorientation = "portrait";
var __loadQueue = [
    "libs/laya/2.10.0/laya.core.js",
    "libs/laya/2.10.0/laya.ani.js",
    "libs/laya/2.10.0/laya.ui.js",
    "libs/laya/2.10.0/laya.d3.js",
    "libs/laya/2.10.0/laya.physics3D.js",
    "myself/SpineAnimation.js",
    "myself/Logger.js",
    "myself/RandomUtils.js",
    "myself/ArrayUtils.js",
    "js/bundle.js"
];
function loadLib(url) {
    var script = document.createElement("script");
    script.async = false;
    script.src = url;
    document.body.appendChild(script);
}
__loadQueue.forEach(loadLib);
