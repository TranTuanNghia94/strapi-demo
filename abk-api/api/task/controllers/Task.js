'use strict';

/**
 * Task.js controller
 *
 * @description: A set of functions called "actions" for managing `Task`.
 */

module.exports = {
  /**
   * Retrieve task records.
   *
   * @return {Object|Array}
   */

  find: async (ctx, next, { populate } = {}) => {
    if (ctx.query._q) {
      return strapi.services.task.search(ctx.query);
    } else {
      return strapi.services.task.fetchAll(ctx.query, populate);
    }
  },

  /**
   * Retrieve a task record.
   *
   * @return {Object}
   */

  findOne: async ctx => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.task.fetch(ctx.params);
  },

  /**
   * Count task records.
   *
   * @return {Number}
   */

  count: async ctx => {
    return strapi.services.task.count(ctx.query);
  },

  /**
   * Create a/an task record.
   *
   * @return {Object}
   */

  create: async ctx => {
    return strapi.services.task.add(ctx.request.body);
  },

  /**
   * Update a/an task record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    let update = await strapi.services.task.edit(ctx.params, ctx.request.body);

    if (ctx.request.body.status) {
      try {
        let task = await strapi.services.task.fetch(ctx.params).populate([{
          path: "orderitem",
          populate: [{
            path: "product"
          }, {
            path: "where_to_buy_location"
          }]
        }, {
          path: "delivery_location"
        }, {
          path: "trip",
          populate: [{
            path: "from"
          }, {
            path: "to"
          }, {
            path: "user"
          }]
        }]);

        let oldStatus;
        switch (task.status) {
          case 'accepted':
            oldStatus = 'Pending';
            break;
          case 'picked':
            oldStatus = 'Accepted';
          case 'done':
            oldStatus = 'Picked';
          default:
            oldStatus = 'Pending';
        }

        let taskInfo =
          ` - Name: ${task.name}\n` +
          ` - Reward: ${task.reward}\n` +
          ` - Remaining: ${task.remaining}\n` +
          ` - Price: ${task.price}\n` +
          ` - Quantity: ${task.quantity}\n` +
          ` - Delivery date: ${task.delivery_date}\n`;

        let userInfo =
          `User:\n` +
          `- Name: ${task.trip.user.firstname} ${task.trip.user.lastname}\n` +
          `- Phone: ${task.trip.user.phone}\n` +
          `- Email: ${task.trip.user.email}`;

        let message = `*ABK TASK STATUS* *${oldStatus}* to *${task.status}* \nTask Info:\n${taskInfo}${userInfo}`;
        strapi.sendWebhookTelegram(message)
      } catch (e) {

      }
    }

    return update;
  },

  /**
   * Destroy a/an task record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.task.remove(ctx.params);
  },

  findByTraveler: async (ctx, next) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.badRequest(null, [{ messages: [{ id: 'No authorization header was found' }] }]);
    }
    return strapi.services.task.traveler({ id: user.id || user._id });
  },

  findOneByTraveler: async (ctx, next) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.badRequest(null, [{ messages: [{ id: 'No authorization header was found' }] }]);
    }
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }
    return strapi.services.task.fetchOneByTraveler({ id: ctx.params._id });
  },
};
