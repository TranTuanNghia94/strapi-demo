'use strict';

/**
 * A set of functions called "actions" for `Checking`
 */

module.exports = {
  // exampleAction: async (ctx, next) => {
  //   try {
  //     ctx.body = 'ok';
  //   } catch (err) {
  //     ctx.body = err;
  //   }
  // }

  checkPhone: async (ctx, next) => {
    const user = await strapi.plugins['users-permissions']
      .queries('user', 'users-permissions')
      .findOne({
        phone: ctx.params.phone,
      });
    return user ? 1 : 0
  }
};
