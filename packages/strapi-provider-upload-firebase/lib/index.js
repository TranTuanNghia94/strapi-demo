'use strict';

/**
 * Module dependencies
 */

// Public node modules.
/* eslint-disable no-unused-vars */
module.exports = {
  provider: 'firebase',
  name: 'Firebase storage server',
  auth: {
    bucket: {
      label: 'Bucket Name',
      type: 'text'
    }
  },
  init: (config) => {
    return {
      upload: (file) => {
        return new Promise(async (resolve, reject) => {
          const service = strapi.plugins.upload.services.upload;
          const related = (file.related && file.related[0]) ? '/' + file.related[0].refId : '';
          const filePath = `images${related}/${file.hash}${file.ext}`;

          const bucket = strapi.firebaseAdmin.storage().bucket(config.bucket);
          const uploadFirebase = ({ name, buffer, mime }, filePath) => {
            return new Promise((res, rej) => {
              bucket
                .file(filePath)
                .save(buffer, {
                  contentType: mime,
                  public: true,
                  metadata: {
                    // Download as original filename
                    contentDisposition: `inline; filename="${name}"`
                  }
                })
                .then(() => res())
                .catch((err) => rej(err))
            })
          }
          try {
            await uploadFirebase(file, filePath);
          } catch (error) {
            return reject(error);
          }
          file.url = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
          if (!file.dimension) {
            const info = await service.metadata(file.buffer);
            file.dimension = {
              width: info.width,
              height: info.height,
            }
          }
          if (file.dimension.width > 256) {
            const buffer256 = await service.resize(file.buffer, 256);
            const path256 = `images${related}/${file.hash}_md${file.ext}`;
            try {
              await uploadFirebase({ buffer: buffer256, mime: file.mime, name: file.name }, path256);
              file.url_256 = `https://storage.googleapis.com/${bucket.name}/${path256}`;
            } catch (error) {
              strapi.log.warn('fail to upload 256 width dimension ' + error)
            }
          }
          if (file.dimension.width > 128) {
            const buffer128 = await service.resize(file.buffer, 128);
            const path128 = `images${related}/${file.hash}_sm${file.ext}`;
            try {
              await uploadFirebase({ buffer: buffer128, mime: file.mime, name: file.name }, path128);
              file.url_128 = `https://storage.googleapis.com/${bucket.name}/${path128}`;
            } catch (error) {
              strapi.log.warn('fail to upload 128 width dimension ' + error)
            }
          }

          strapi.log.debug(`File successfully uploaded to firebase`);
          resolve();
        })
      },
      delete: (file) => {
        return new Promise(async (resolve, reject) => {
          const related = (file.related && file.related[0]) ? '/' + file.related[0].refId : '';

          var bucket = strapi.firebaseAdmin.storage().bucket(config.bucket);

          const deleteFirebase = (filePath) => {
            return new Promise((res, rej) => {
              bucket
                .file(filePath)
                .delete()
                .catch(error => {
                  if (error.code === 404) {
                    return strapi.log.warn(
                      'Remote file was not found, you may have to delete manually.'
                    );
                  }
                  rej(error);
                });

              res()
            })
          }
          await deleteFirebase(`images${related}/${file.hash}${file.ext}`);
          if (file.url_256) {
            await deleteFirebase(`images${related}/${file.hash}_md${file.ext}`);
          }
          if (file.url_128) {
            await deleteFirebase(`images${related}/${file.hash}_sm${file.ext}`);
          }

          strapi.log.debug(`File ${file.url} successfully deleted`);
          resolve();
        })
      }
    };
  }
};
