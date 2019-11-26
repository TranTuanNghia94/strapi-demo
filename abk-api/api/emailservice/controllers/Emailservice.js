'use strict';

/**
 * Emailservice.js controller
 *
 * @description: A set of functions called "actions" for managing `Emailservice`.
 */

module.exports = {

  /**
   * Retrieve emailservice records.
   *
   * @return {Object|Array}
   */

  find: async (ctx, next, { populate } = {}) => {
    if (ctx.query._q) {
      return strapi.services.emailservice.search(ctx.query);
    } else {
      return strapi.services.emailservice.fetchAll(ctx.query, populate);
    }
  },

  /**
   * Retrieve a emailservice record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.emailservice.fetch(ctx.params);
  },

  /**
   * Count emailservice records.
   *
   * @return {Number}
   */

  count: async (ctx) => {
    return strapi.services.emailservice.count(ctx.query);
  },

  /**
   * Create a/an emailservice record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.emailservice.add(ctx.request.body);
  },

  /**
   * Update a/an emailservice record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.emailservice.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an emailservice record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.emailservice.remove(ctx.params);
  }
};
