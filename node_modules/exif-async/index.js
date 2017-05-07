const ExifImage = require("exif");

module.exports = function (image) {
  return new Promise((resolve, reject) => {
    new ExifImage({ image }, (err, exifData) => {
      if (err) {
        reject(err);
      } else {
        resolve(exifData);
      }
    });
  });
};
