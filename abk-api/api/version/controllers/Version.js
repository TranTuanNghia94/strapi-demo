'use strict';

/**
 * Version.js controller
 *
 * @description: A set of functions called "actions" for managing `Version`.
 */

module.exports = {

  /**
   * Retrieve version records.
   *
   * @return {Object|Array}
   */

  find: async (ctx, next, { populate } = {}) => {
    if (ctx.query._q) {
      return strapi.services.version.search(ctx.query);
    } else {
      return strapi.services.version.fetchAll(ctx.query, populate);
    }
  },

  /**
   * Retrieve a version record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.version.fetch(ctx.params);
  },

  /**
   * Count version records.
   *
   * @return {Number}
   */

  count: async (ctx) => {
    return strapi.services.version.count(ctx.query);
  },

  /**
   * Create a/an version record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.version.add(ctx.request.body);
  },

  /**
   * Update a/an version record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.version.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an version record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.version.remove(ctx.params);
  }
};
