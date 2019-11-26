'use strict';

/**
 * Module dependencies.
 */

// Public node modules.
const _ = require('lodash');
const request = require('request');

// Purest strategies.<
const Purest = require('purest');

/**
 * Connect thanks to a third-party provider.
 *
 *
 * @param {String}    provider
 * @param {String}    access_token
 *
 * @return  {*}
 */

exports.connect = (provider, query) => {
  const access_token = query.access_token || query.code || query.oauth_token;

  return new Promise((resolve, reject) => {
    if (!access_token) {
      return reject(null, {
        message: 'No access_token.'
      });
    }

    // Get the profile.
    getProfile(provider, query, async (err, profile) => {
      if (err) {
        return reject(err);
      }

      // We need at least the mail.
      if (!profile.email) {
        return reject([{
          message: 'Email was not available.'
        }, null]);
      }

      try {
        const users = await strapi.plugins['users-permissions'].queries('user', 'users-permissions').find({
          email: profile.email
        });

        const advanced = await strapi.store({
          environment: '',
          type: 'plugin',
          name: 'users-permissions',
          key: 'advanced'
        }).get();

        if (_.isEmpty(_.find(users, { provider })) && !advanced.allow_register) {
          return resolve([null, [{ messages: [{ id: 'Auth.advanced.allow_register' }] }], 'Register action is actualy not available.']);
        }

        const user = _.find(users, { provider });

        if (!_.isEmpty(user)) {
          return resolve([user, null]);
        }

        if (!_.isEmpty(_.find(users, user => user.provider !== provider)) && advanced.unique_email) {
          return resolve([null, [{ messages: [{ id: 'Auth.form.error.email.taken' }] }], 'Email is already taken.']);
        }

        // Retrieve default role.
        const defaultRole = await strapi.plugins['users-permissions'].queries('role', 'users-permissions').findOne({ type: query.role || advanced.default_role }, []);

        // Create the new user.
        const params = _.assign(profile, {
          provider: provider,
          role: defaultRole._id || defaultRole.id
        });

        const createdUser = await strapi.plugins['users-permissions'].queries('user', 'users-permissions').create(params);

        if (provider === 'facebook') {
          const imageUrl = new URL(params.picture.data.url);
          const search_params = imageUrl.searchParams;
          const hash = search_params.get('hash');
          var avatar = Object.assign({
            ext: ".jpg",
            hash,
            mime: "image/jpeg",
            name: hash + ".jpg",
            provider: provider,
            sha256: hash,
            size: "1",
          }, params.picture.data, {
            related: [{
              refId: createdUser.id || createdUser._id,
              ref: 'user',
              source: 'users-permissions',
              field: 'avatar'
            }]
          });

          const res = await strapi.plugins.upload.services.upload.add(avatar);
          createdUser.avatar = res;
          // send webhook message to telegram
          var message =
            `User:\n` +
            ` - Login by Facebook\n` +
            ` - Name: ${createdUser.firstname} ${createdUser.lastname}\n` +
            ` - Phone: ${createdUser.phone}\n` +
            ` - Email: ${createdUser.email}`;
          var subject = `*ABK ${defaultRole.name} ADDED*`;
          strapi.sendWebhookTelegram(`${subject}\n${message}\n`);
        }

        return resolve([createdUser, null]);
      } catch (err) {
        reject([null, err]);
      }
    });
  });
};

/**
 * Helper to get profiles
 *
 * @param {String}   provider
 * @param {Function} callback
 */

const getProfile = async (provider, query, callback) => {
  const access_token = query.access_token || query.code || query.oauth_token;

  const grant = await strapi.store({
    environment: '',
    type: 'plugin',
    name: 'users-permissions',
    key: 'grant'
  }).get();

  switch (provider) {
    case 'discord': {
      const discord = new Purest({
        provider: 'discord',
        config: {
          'discord': {
            'https://discordapp.com/api/': {
              '__domain': {
                'auth': {
                  'auth': { 'bearer': '[0]' }
                }
              },
              '{endpoint}': {
                '__path': {
                  'alias': '__default'
                }
              }
            }
          }
        }
      });
      discord.query().get('users/@me').auth(access_token).request((err, res, body) => {
        if (err) {
          callback(err);
        } else {
          // Combine username and discriminator because discord username is not unique
          var username = `${body.username}#${body.discriminator}`;
          callback(null, {
            username: username,
            email: body.email
          });
        }
      });
      break;
    }
    case 'facebook': {
      const facebook = new Purest({
        provider: 'facebook'
      });

      facebook.query().get('me?fields=name,first_name,last_name,email,picture.width(96).height(96)').auth(access_token).request((err, res, body) => {
        if (err) {
          callback(err);
        } else {
          callback(null, {
            username: body.email,
            email: body.email,
            picture: body.picture,
            firstname: body.first_name,
            lastname: body.last_name,
            phone: body.phone || body.email,
          });
        }
      });
      break;
    }
    case 'google': {
      const google = new Purest({
        provider: 'google'
      });

      google.query('plus').get('people/me').auth(access_token).request((err, res, body) => {
        if (err) {
          callback(err);
        } else {
          callback(null, {
            username: body.emails[0].value.split("@")[0],
            email: body.emails[0].value
          });
        }
      });
      break;
    }
    case 'github': {
      const github = new Purest({
        provider: 'github',
        defaults: {
          headers: {
            'user-agent': 'strapi'
          }
        }
      });

      request.post({
        url: 'https://github.com/login/oauth/access_token',
        form: {
          client_id: grant.github.key,
          client_secret: grant.github.secret,
          code: access_token
        }
      }, (err, res, body) => {
        github.query().get('user').auth(body.split('&')[0].split('=')[1]).request((err, res, body) => {
          if (err) {
            callback(err);
          } else {
            callback(null, {
              username: body.login,
              email: body.email
            });
          }
        });
      });
      break;
    }
    case 'microsoft': {
      const microsoft = new Purest({
        provider: 'microsoft',
        config: {
          'microsoft': {
            'https://graph.microsoft.com': {
              '__domain': {
                'auth': {
                  'auth': { 'bearer': '[0]' }
                }
              },
              '[version]/{endpoint}': {
                '__path': {
                  'alias': '__default',
                  'version': 'v1.0'
                }
              }
            }
          }
        }
      });

      microsoft.query().get('me').auth(access_token).request((err, res, body) => {
        if (err) {
          callback(err);
        } else {
          callback(null, {
            username: body.userPrincipalName,
            email: body.userPrincipalName
          });
        }
      });
      break;
    }
    case 'twitter': {
      const twitter = new Purest({
        provider: 'twitter',
        key: grant.twitter.key,
        secret: grant.twitter.secret
      });

      twitter.query().get('account/verify_credentials').auth(access_token, query.access_secret).qs({ screen_name: query['raw[screen_name]'], include_email: 'true' }).request((err, res, body) => {
        if (err) {
          callback(err);
        } else {
          callback(null, {
            username: body.screen_name,
            email: body.email
          });
        }
      });
      break;
    }
    default:
      callback({
        message: 'Unknown provider.'
      });
      break;
  }
};
