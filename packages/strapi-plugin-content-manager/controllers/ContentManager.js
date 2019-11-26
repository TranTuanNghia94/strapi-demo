'use strict';

const _ = require('lodash');

/**
 * A set of functions called "actions" for `ContentManager`
 */

module.exports = {
  models: async ctx => {
    const pluginsStore = strapi.store({
      environment: '',
      type: 'plugin',
      name: 'content-manager',
    });

    const models = await pluginsStore.get({ key: 'schema' });

    ctx.body = {
      models,
    };
  },

  find: async ctx => {
    // Search
    if (!_.isEmpty(ctx.request.query._q)) {
      ctx.body = await strapi.plugins['content-manager'].services['contentmanager'].search(ctx.params, ctx.request.query);

      return;
    }

    // Default list with filters or not.
    ctx.body = await strapi.plugins['content-manager'].services['contentmanager'].fetchAll(ctx.params, ctx.request.query);
  },

  count: async ctx => {
    // Search
    const count = !_.isEmpty(ctx.request.query._q)
      ? await strapi.plugins['content-manager'].services['contentmanager'].countSearch(ctx.params, ctx.request.query)
      : await strapi.plugins['content-manager'].services['contentmanager'].count(ctx.params, ctx.request.query);

    ctx.body = {
      count: _.isNumber(count) ? count : _.toNumber(count)
    };
  },

  findOne: async ctx => {
    const { source } = ctx.request.query;

    // Find an entry using `queries` system
    const entry = await strapi.plugins['content-manager'].services['contentmanager'].fetch(ctx.params, source, null, false);

    // Entry not found
    if (!entry) {
      return (ctx.notFound('Entry not found'));
    }

    ctx.body = entry;
  },

  create: async ctx => {
    const { source } = ctx.request.query;

    try {
      // Create an entry using `queries` system
      ctx.body = await strapi.plugins['content-manager'].services['contentmanager'].add(ctx.params, ctx.request.body, source);
      if (ctx.params.model == 'task' && ctx.body.trip) {
        let user = await strapi.plugins['users-permissions'].services.user.fetch(ctx.body.trip.user);
        let product = await Product.findOne(ctx.body.orderitem.product);
        if (user.firebase_token) {
          strapi.emitFirebase({
            data: {
              action: 'task assigned',
              action_code: '1',
              createAt: ctx.body.updatedAt.toISOString(),
              target: ctx.body.id,
              attachment: product.cover.url,
              thumb: product.thumb.length ? product.thumb[0].url : product.cover.url
            },
            notification: {
              title: 'New task is waiting for you',
              body: ctx.body.name + '\n+' + Number(ctx.body.reward).toLocaleString() + '₫'
            },
            apns: {
              payload: {
                aps: {
                  category: "newTaskPush",
                  "mutable_content": true,
                  "mutable-content": true,
                  "content-available": true,
                  "content_available": true
                }
              }
            },
            token: user.firebase_token
          })
        }
      }
      strapi.emit('didCreateFirstContentTypeEntry', ctx.params, source);
    } catch(error) {
      strapi.log.error(error);
      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: error.message, field: error.field }] }] : error.message);
    }
  },

  update: async ctx => {
    const { source } = ctx.request.query;

    try {
      // Return the last one which is the current model.
      ctx.body = await strapi.plugins['content-manager'].services['contentmanager'].edit(ctx.params, ctx.request.body, source);
      if (ctx.params.model == 'task' && ctx.body.trip) {
        let user = await strapi.plugins['users-permissions'].services.user.fetch(ctx.body.trip.user);
        let product = await Product.findOne(ctx.body.orderitem.product);
        if (user.firebase_token) {
          strapi.emitFirebase({
            data: {
              action: 'task updated',
              action_code: '2',
              createAt: ctx.body.updatedAt.toISOString(),
              target: ctx.body.id,
              attachment: product.cover.url,
              thumb: product.thumb.length ? product.thumb[0].url : product.cover.url
            },
            notification: {
              title: 'New task is waiting for you',
              body: ctx.body.name + '\n+' + Number(ctx.body.reward).toLocaleString() + '₫'
            },
            apns: {
              payload: {
                aps: {
                  category: "newTaskPush",
                  "mutable_content": true,
                  "mutable-content": true,
                  "content-available": true,
                  "content_available": true
                }
              }
            },
            token: user.firebase_token
          })
        }
      }
    } catch(error) {
      // TODO handle error update
      strapi.log.error(error);
      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: error.message, field: error.field }] }] : error.message);
    }
  },

  updateSettings: async ctx => {
    const { schema } = ctx.request.body;
    const pluginStore = strapi.store({
      environment: '',
      type: 'plugin',
      name: 'content-manager'
    });
    await pluginStore.set({ key: 'schema', value: schema });

    return ctx.body = { ok: true };
  },

  delete: async ctx => {
    ctx.body = await strapi.plugins['content-manager'].services['contentmanager'].delete(ctx.params, ctx.request.query);
  },

  deleteAll: async ctx => {
    ctx.body = await strapi.plugins['content-manager'].services['contentmanager'].deleteMany(ctx.params, ctx.request.query);
  }
};
