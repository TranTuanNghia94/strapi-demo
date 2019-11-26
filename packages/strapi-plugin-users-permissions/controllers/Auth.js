'use strict';

/**
 * Auth.js controller
 *
 * @description: A set of functions called "actions" for managing `Auth`.
 */

/* eslint-disable no-useless-escape */
const crypto = require('crypto');
const _ = require('lodash');
const compose = require('koa-compose');

const emailRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

module.exports = {
  callback: async ctx => {
    const provider = ctx.params.provider || 'local';
    const params = ctx.request.body;

    const store = await strapi.store({
      environment: '',
      type: 'plugin',
      name: 'users-permissions',
    });

    if (provider === 'local') {
      if (
        !_.get(await store.get({ key: 'grant' }), 'email.enabled') &&
        !ctx.request.admin
      ) {
        return ctx.badRequest(null, 'This provider is disabled.');
      }

      // The identifier is required.
      if (!params.identifier) {
        return ctx.badRequest(
          null,
          ctx.request.admin
            ? [{ messages: [{ id: 'Auth.form.error.email.provide' }] }]
            : 'Please provide your username or your e-mail.'
        );
      }

      // The password is required.
      if (!params.password) {
        return ctx.badRequest(
          null,
          ctx.request.admin
            ? [{ messages: [{ id: 'Auth.form.error.password.provide' }] }]
            : 'Please provide your password.'
        );
      }

      const query = {};

      // Check if the provided identifier is an email or not.
      const isEmail = emailRegExp.test(params.identifier);

      // Set the identifier to the appropriate query field.
      if (isEmail) {
        query.email = params.identifier.toLowerCase();
      } else {
        query.username = params.identifier;
      }

      // Check if the user exists.
      const user = await strapi.plugins['users-permissions']
        .queries('user', 'users-permissions')
        .findOne(query, ['role']);

      if (!user) {
        return ctx.badRequest(
          null,
          ctx.request.admin
            ? [{ messages: [{ id: 'Auth.form.error.invalid' }] }]
            : 'Identifier or password invalid.'
        );
      }

      if (
        _.get(await store.get({ key: 'advanced' }), 'email_confirmation') &&
        user.confirmed !== true
      ) {
        return ctx.badRequest(
          null,
          ctx.request.admin
            ? [{ messages: [{ id: 'Auth.form.error.confirmed' }] }]
            : 'Your account email is not confirmed.'
        );
      }

      if (user.blocked === true) {
        return ctx.badRequest(
          null,
          ctx.request.admin
            ? [{ messages: [{ id: 'Auth.form.error.blocked' }] }]
            : 'Your account has been blocked by the administrator.'
        );
      }

      // The user never authenticated with the `local` provider.
      if (!user.password) {
        return ctx.badRequest(
          null,
          ctx.request.admin
            ? [{ messages: [{ id: 'Auth.form.error.password.local' }] }]
            : 'This user never set a local password, please login thanks to the provider used during account creation.'
        );
      }

      const validPassword = strapi.plugins[
        'users-permissions'
      ].services.user.validatePassword(params.password, user.password);

      if (!validPassword) {
        return ctx.badRequest(
          null,
          ctx.request.admin
            ? [{ messages: [{ id: 'Auth.form.error.invalid' }] }]
            : 'Identifier or password invalid.'
        );
      } else {

        let customToken;
        // need add uid of firebase to user model
        const firebaseAuth = strapi.firebaseAdmin.auth();
        try {
          if (user.uid) {
            customToken = await firebaseAuth.createCustomToken(user.uid);
          } else {
            let firebaseUser = await firebaseAuth.getUserByPhoneNumber(user.phone);
            if (!firebaseUser || !firebaseUser.uid) {
              firebaseUser = await firebaseAuth.getUserByEmail(user.email);
            }
            customToken = await firebaseAuth.createCustomToken(firebaseUser.uid);
            await strapi.plugins['users-permissions'].services.user.edit(
              _.pick(user, ['_id', 'id']),
              { uid: firebaseUser.uid }
            );
          }
        } catch (e) {
          strapi.log.error(e)
          try {
            const firebaseUser = await firebaseAuth.createUser({
              email: user.email,
              emailVerified: true,
              phoneNumber: user.phone,
              displayName: user.firstname + ' ' + user.lastname,
              disabled: false,
            })
            customToken = await firebaseAuth.createCustomToken(firebaseUser.uid);
            await strapi.plugins['users-permissions'].services.user.edit(
              _.pick(user, ['_id', 'id']),
              { uid: firebaseUser.uid }
            );
          } catch (e) {
            strapi.log.error(e)
          }
        }
        // }

        ctx.send({
          jwt: strapi.plugins['users-permissions'].services.jwt.issue(
            _.pick(user.toJSON ? user.toJSON() : user, ['_id', 'id'])
          ),
          user: _.omit(user.toJSON ? user.toJSON() : user, [
            'password',
            'resetPasswordToken',
          ]),
          customToken: customToken
        });
      }
    } else {
      if (!_.get(await store.get({ key: 'grant' }), [provider, 'enabled'])) {
        return ctx.badRequest(null, 'This provider is disabled.');
      }

      // Connect the user thanks to the third-party provider.
      let user, error;
      try {
        [user, error] = await strapi.plugins[
          'users-permissions'
        ].services.providers.connect(provider, ctx.query);
      } catch ([user, error]) {
        return ctx.badRequest(
          null,
          error === 'array' ? (ctx.request.admin ? error[0] : error[1]) : error
        );
      }

      if (!user) {
        return ctx.badRequest(
          null,
          error === 'array' ? (ctx.request.admin ? error[0] : error[1]) : error
        );
      }

      let customToken;
      const firebaseAuth = strapi.firebaseAdmin.auth();
      try {
        if (user.uid) {
          customToken = await firebaseAuth.createCustomToken(user.uid);
        } else {
          let firebaseUser;
          if (user.phone && provider !== 'facebook') {// node: provider facebook replace phone number by email for now
            firebaseUser = await firebaseAuth.getUserByPhoneNumber(user.phone);
          }
          if (!firebaseUser || !firebaseUser.uid) {
            firebaseUser = await firebaseAuth.getUserByEmail(user.email);
          }
          customToken = await firebaseAuth.createCustomToken(firebaseUser.uid);
          await strapi.plugins['users-permissions'].services.user.edit(
            _.pick(user, ['_id', 'id']),
            { uid: firebaseUser.uid }
          );
        }
      } catch (e) {
        strapi.log.error(e)
        try {
          const firebaseUser = await firebaseAuth.createUser({
            email: user.email,
            emailVerified: true,
            phoneNumber: provider !== 'facebook' ? user.phone : undefined,
            displayName: user.username,
            disabled: false,
          })
          customToken = await firebaseAuth.createCustomToken(firebaseUser.uid);
          await strapi.plugins['users-permissions'].services.user.edit(
            _.pick(user, ['_id', 'id']),
            { uid: firebaseUser.uid }
          );
        } catch (e) {
          strapi.log.error(e)
        }
      }

      ctx.send({
        jwt: strapi.plugins['users-permissions'].services.jwt.issue(
          _.pick(user, ['_id', 'id'])
        ),
        user: _.omit(user.toJSON ? user.toJSON() : user, [
          'password',
          'resetPasswordToken',
        ]),
        customToken: customToken
      });
    }
  },

  changePassword: async ctx => {
    const params = _.assign({}, ctx.request.body, ctx.params);

    if (params.password && params.identifier && params.id_token) {
      const decodedToken = await strapi.firebaseAdmin.auth().verifyIdToken(params.id_token);
      if (decodedToken && decodedToken.phone_number === params.identifier) {
        const user = await strapi.plugins['users-permissions']
          .queries('user', 'users-permissions')
          .findOne({ username: params.identifier });

        if (!user) {
          return ctx.badRequest(
            null,
            ctx.request.admin
              ? [{ messages: [{ id: 'Auth.form.error.code.provide' }] }]
              : 'Incorrect code provided.'
          );
        }

        user.resetPasswordToken = null;

        user.password = await strapi.plugins[
          'users-permissions'
        ].services.user.hashPassword(params);

        // Remove relations data to update user password.
        const data = _.omit(
          user,
          strapi.plugins['users-permissions'].models.user.associations.map(
            ast => ast.alias
          )
        );

        // Update the user.
        await strapi.plugins['users-permissions']
          .queries('user', 'users-permissions')
          .update(data);

        ctx.send({
          jwt: strapi.plugins['users-permissions'].services.jwt.issue(
            _.pick(user.toJSON ? user.toJSON() : user, ['_id', 'id'])
          ),
          user: _.omit(user.toJSON ? user.toJSON() : user, [
            'password',
            'resetPasswordToken',
          ]),
        });
      } else {
        return ctx.badRequest(
          null,
          ctx.request.admin
            ? [{ messages: [{ id: 'Auth.form.error.code.provide' }] }]
            : 'Incorrect code provided.'
        );
      }
    } else if (
      params.password &&
      params.passwordConfirmation &&
      params.password === params.passwordConfirmation &&
      params.code
    ) {
      const user = await strapi.plugins['users-permissions']
        .queries('user', 'users-permissions')
        .findOne({ resetPasswordToken: params.code });

      if (!user) {
        return ctx.badRequest(
          null,
          ctx.request.admin
            ? [{ messages: [{ id: 'Auth.form.error.code.provide' }] }]
            : 'Incorrect code provided.'
        );
      }

      // Delete the current code
      user.resetPasswordToken = null;

      user.password = await strapi.plugins[
        'users-permissions'
      ].services.user.hashPassword(params);

      // Remove relations data to update user password.
      const data = _.omit(
        user,
        strapi.plugins['users-permissions'].models.user.associations.map(
          ast => ast.alias
        )
      );

      // Update the user.
      await strapi.plugins['users-permissions']
        .queries('user', 'users-permissions')
        .update(data);

      ctx.send({
        jwt: strapi.plugins['users-permissions'].services.jwt.issue(
          _.pick(user.toJSON ? user.toJSON() : user, ['_id', 'id'])
        ),
        user: _.omit(user.toJSON ? user.toJSON() : user, [
          'password',
          'resetPasswordToken',
        ]),
      });
    } else if (
      params.password &&
      params.old_password
    ) {
      if (params.password === params.old_password) {
        return ctx.badRequest(
          null,
          ctx.request.admin
            ? [{ messages: [{ id: 'Auth.form.error.password.matching' }] }]
            : 'New password matches the old password.'
        );
      } else {
        const user = ctx.state.user;

        if (!user) {
          return ctx.badRequest(null, [{ messages: [{ id: 'No authorization header was found' }] }]);
        }

        const validPassword = strapi.plugins[
          'users-permissions'
        ].services.user.validatePassword(params.old_password, user.password);

        if (!validPassword) {
          return ctx.badRequest(
            null,
            ctx.request.admin
              ? [{ messages: [{ id: 'Auth.form.error.invalid' }] }]
              : 'Identifier or password invalid.'
          );
        } else {
          user.password = await strapi.plugins[
            'users-permissions'
          ].services.user.hashPassword(params);

          // Remove relations data to update user password.
          const data = _.omit(
            user,
            strapi.plugins['users-permissions'].models.user.associations.map(
              ast => ast.alias
            )
          );

          // Update the user.
          await strapi.plugins['users-permissions']
            .queries('user', 'users-permissions')
            .update(data);

          ctx.send({
            jwt: strapi.plugins['users-permissions'].services.jwt.issue(
              _.pick(user.toJSON ? user.toJSON() : user, ['_id', 'id'])
            ),
            user: _.omit(user.toJSON ? user.toJSON() : user, [
              'password',
              'resetPasswordToken',
            ]),
          });
        }
      }
    } else if (
      params.password &&
      params.passwordConfirmation &&
      params.password !== params.passwordConfirmation
    ) {
      return ctx.badRequest(
        null,
        ctx.request.admin
          ? [{ messages: [{ id: 'Auth.form.error.password.matching' }] }]
          : 'Passwords do not match.'
      );
    } else {
      return ctx.badRequest(
        null,
        ctx.request.admin
          ? [{ messages: [{ id: 'Auth.form.error.params.provide' }] }]
          : 'Incorrect params provided.'
      );
    }
  },

  connect: async (ctx, next) => {
    const grantConfig = await strapi
      .store({
        environment: '',
        type: 'plugin',
        name: 'users-permissions',
        key: 'grant',
      })
      .get();

    const [protocol, host] = strapi.config.url.split('://');
    _.defaultsDeep(grantConfig, { server: { protocol, host } });

    const provider =
      process.platform === 'win32'
        ? ctx.request.url.split('\\')[2]
        : ctx.request.url.split('/')[2];
    const config = grantConfig[provider];

    if (!_.get(config, 'enabled')) {
      return ctx.badRequest(null, 'This provider is disabled.');
    }

    // const Grant = require('grant-koa');
    // const grant = new Grant(grantConfig);

    // return compose(grant.middleware)(ctx, next);
    const grant = require('grant-koa');
    const g = grant(grantConfig);

    return g(ctx, next);
  },

  forgotPassword: async ctx => {
    const { email, url } = ctx.request.body;

    // Find the user user thanks to his email.
    const user = await strapi.plugins['users-permissions']
      .queries('user', 'users-permissions')
      .findOne({ email });

    // User not found.
    if (!user) {
      return ctx.badRequest(
        null,
        ctx.request.admin
          ? [{ messages: [{ id: 'Auth.form.error.user.not-exist' }] }]
          : 'This email does not exist.'
      );
    }

    // Generate random token.
    const resetPasswordToken = crypto.randomBytes(64).toString('hex');

    // Set the property code.
    user.resetPasswordToken = resetPasswordToken;

    const settings = (await strapi
      .store({
        environment: '',
        type: 'plugin',
        name: 'users-permissions',
      })
      .get({ key: 'email' }))['reset_password'].options;

    settings.message = await strapi.plugins[
      'users-permissions'
    ].services.userspermissions.template(settings.message, {
      URL: url,
      USER: _.omit(user.toJSON ? user.toJSON() : user, [
        'password',
        'resetPasswordToken',
        'role',
        'provider',
      ]),
      TOKEN: resetPasswordToken,
    });

    settings.object = await strapi.plugins[
      'users-permissions'
    ].services.userspermissions.template(settings.object, {
      USER: _.omit(user.toJSON ? user.toJSON() : user, [
        'password',
        'resetPasswordToken',
        'role',
        'provider',
      ]),
    });

    try {
      // Send an email to the user.
      await strapi.plugins['email'].services.email.send({
        to: user.email,
        from:
          settings.from.email || settings.from.name
            ? `"${settings.from.name}" <${settings.from.email}>`
            : undefined,
        replyTo: settings.response_email,
        subject: settings.object,
        text: settings.message,
        html: settings.message,
      });
      strapi.services.emailservice.add({
        storeEmail: 'reset_password',
        timestamp: new Date().getTime(),
        status: 'sent',
        priority: 1,
        params: {},
        users: [user.id || user._id]
      });
    } catch (err) {
      return ctx.badRequest(null, err);
    }

    // Remove relations data to update user code.
    const data = _.omit(
      user,
      strapi.plugins['users-permissions'].models.user.associations.map(
        ast => ast.alias
      )
    );

    // Update the user.
    await strapi.plugins['users-permissions']
      .queries('user', 'users-permissions')
      .update(data);

    ctx.send({ ok: true });
  },

  register: async ctx => {
    const pluginStore = await strapi.store({
      environment: '',
      type: 'plugin',
      name: 'users-permissions',
    });

    const settings = await pluginStore.get({
      key: 'advanced',
    });

    if (!settings.allow_register) {
      return ctx.badRequest(
        null,
        ctx.request.admin
          ? [{ messages: [{ id: 'Auth.advanced.allow_register' }] }]
          : 'Register action is currently disabled.'
      );
    }

    const params = _.assign(ctx.request.body, {
      provider: 'local',
    });

    // Password is required.
    if (!params.password) {
      return ctx.badRequest(
        null,
        ctx.request.admin
          ? [{ messages: [{ id: 'Auth.form.error.password.provide' }] }]
          : 'Please provide your password.'
      );
    }

    // Throw an error if the password selected by the user
    // contains more than two times the symbol '$'.
    if (
      strapi.plugins['users-permissions'].services.user.isHashed(
        params.password
      )
    ) {
      return ctx.badRequest(
        null,
        ctx.request.admin
          ? [{ messages: [{ id: 'Auth.form.error.password.format' }] }]
          : 'Your password cannot contain more than three times the symbol `$`.'
      );
    }

    const role = await strapi.plugins['users-permissions']
      .queries('role', 'users-permissions')
      .findOne({ type: params.role || settings.default_role }, []);

    if (!role) {
      return ctx.badRequest(
        null,
        ctx.request.admin
          ? [{ messages: [{ id: 'Auth.form.error.role.notFound' }] }]
          : 'Impossible to find the default role.'
      );
    }

    // Check if the provided email is valid or not.
    const isEmail = emailRegExp.test(params.email);

    if (isEmail) {
      params.email = params.email.toLowerCase();
    }

    params.role = role._id || role.id;
    params.password = await strapi.plugins[
      'users-permissions'
    ].services.user.hashPassword(params);

    const user = await strapi.plugins['users-permissions']
      .queries('user', 'users-permissions')
      .findOne({
        email: params.email,
      });

    if (user && user.provider === params.provider) {
      return ctx.badRequest(
        null,
        ctx.request.admin
          ? [{ messages: [{ id: 'Auth.form.error.email.taken' }] }]
          : 'Email is already taken.'
      );
    }

    if (user && user.provider !== params.provider && settings.unique_email) {
      return ctx.badRequest(
        null,
        ctx.request.admin
          ? [{ messages: [{ id: 'Auth.form.error.email.taken' }] }]
          : 'Email is already taken.'
      );
    }

    try {
      // if (!settings.email_confirmation) {
      params.confirmed = true;
      // }

      const user = await strapi.plugins['users-permissions']
        .queries('user', 'users-permissions')
        .create(params);

      const jwt = strapi.plugins['users-permissions'].services.jwt.issue(
        _.pick(user.toJSON ? user.toJSON() : user, ['_id', 'id'])
      );

      const storeEmail =
        (await pluginStore.get({
          key: 'email',
        })) || {};

      const settings = storeEmail['email_confirmation']
        ? storeEmail['email_confirmation'].options
        : {};

      settings.message = await strapi.plugins[
        'users-permissions'
      ].services.userspermissions.template(settings.message, {
        URL: new URL(
          '/auth/email-confirmation',
          strapi.config.url
        ).toString(),
        USER: _.omit(user.toJSON ? user.toJSON() : user, [
          'password',
          'resetPasswordToken',
          'role',
          'provider',
        ]),
        CODE: jwt,
      });

      settings.object = await strapi.plugins[
        'users-permissions'
      ].services.userspermissions.template(settings.object, {
        USER: _.omit(user.toJSON ? user.toJSON() : user, [
          'password',
          'resetPasswordToken',
          'role',
          'provider',
        ]),
      });

      try {
        // Send an email to the user.
        await strapi.plugins['email'].services.email.send({
          to: (user.toJSON ? user.toJSON() : user).email,
          from:
            settings.from.email && settings.from.name
              ? `"${settings.from.name}" <${settings.from.email}>`
              : undefined,
          replyTo: settings.response_email,
          subject: settings.object,
          text: settings.message,
          html: settings.message,
        });
        strapi.services.emailservice.add({
          storeEmail: 'email_confirmation',
          timestamp: new Date().getTime(),
          status: 'sent',
          priority: 1,
          params: {},
          users: [user.id || user._id]
        });
        // send webhook message to telegram
        var message =
          `User:\n` +
          ` - Name: ${user.firstname} ${user.lastname}\n` +
          ` - Phone: ${user.phone}\n` +
          ` - Email: ${user.email}`;
        var subject = `*ABK ${role.name} ADDED*`;
        strapi.sendWebhookTelegram(`${subject}\n${message}\n`);
      } catch (err) {
        return ctx.badRequest(null, err);
      }

      ctx.send({
        jwt,
        user: _.omit(user.toJSON ? user.toJSON() : user, [
          'password',
          'resetPasswordToken',
        ]),
      });
    } catch (err) {
      const adminError = _.includes(err.message, 'username')
        ? 'Auth.form.error.username.taken'
        : 'Auth.form.error.email.taken';

      ctx.badRequest(
        null,
        ctx.request.admin ? [{ messages: [{ id: adminError }] }] : err.message
      );
    }
  },

  emailConfirmation: async ctx => {
    const params = ctx.query;

    const user = await strapi.plugins['users-permissions'].services.jwt.verify(
      params.confirmation
    );

    const edited = await strapi.plugins['users-permissions'].services.user.edit(
      _.pick(user, ['_id', 'id']),
      { confirmed: true, emailConfirmed: true }
    );

    const settings = await strapi
      .store({
        environment: '',
        type: 'plugin',
        name: 'users-permissions',
        key: 'advanced',
      })
      .get();

    if (edited && edited.phone) {
      strapi.emitFirebase({
        data: {
          action: 'Email confirmed',
          action_code: '3'
        },
        topic: 'p' + edited.phone.substring(1)
      })
    }

    ctx.redirect(settings.email_confirmation_redirection || '/');
  },
};
