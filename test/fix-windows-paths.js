module.exports = function(f) {
    // de-windows
    return (process.platform !== 'win32') ? f
        : f.replace(/^[a-zA-Z]:[\/\\]+/, '/').replace(/[\\\/]+/g, '/')
};

module.exports.withDriveLetter = function(f) {
    return (process.platform !== 'win32') ? f
        : f.replace(/[\\\/]+/g, '/')
};