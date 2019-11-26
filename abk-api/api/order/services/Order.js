'use strict';

/* global Order */

/**
 * Order.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');
const moment = require('moment');
const shortid = require('shortid-36');
const { convertRestQueryParams, buildQuery } = require('strapi-utils');

module.exports = {

  /**
   * Promise to fetch all orders.
   *
   * @return {Promise}
   */

  fetchAll: (params, populate) => {
    const filters = convertRestQueryParams(params);
    const populateOpt = populate || Order.associations
      .filter(ast => ast.autoPopulate !== false)
      .map(ast => ast.alias)

    return buildQuery({
      model: Order,
      filters,
      populate: populateOpt,
    });
  },

  /**
   * Promise to fetch a/an order.
   *
   * @return {Promise}
   */

  fetch: (params, populate) => {
    // Select field to populate.
    // const populate = Order.associations
    //   .filter(ast => ast.autoPopulate !== false)
    //   .map(ast => ast.alias)
    //   .join(' ');

    return Order
      .findOne(_.pick(params, _.keys(Order.schema.paths)))
      .populate(populate || [{
        path: "orderitems",
        populate: [{
          path: "sku",
          populate: [{
            path: 'product'
          }]
        }, {
          path: "where_to_buy_location"
        }, {
          path: "delivery_location"
        }, {
          path: "tasks",
          populate: [{
            path: "trip",
            populate: [{
              path: "user"
            }, {
              path: "from"
            }, {
              path: "to"
            }]
          }]
        }]
      }, {
        path: "user"
      }]);
  },

  /**
   * Promise to count orders.
   *
   * @return {Promise}
   */

  count: (params) => {
    const filters = convertRestQueryParams(params);

    return buildQuery({
      model: Order,
      filters: { where: filters.where },
    })
      .count()
  },

  /**
   * Promise to add a/an order.
   *
   * @return {Promise}
   */

  add: async (values) => {
    // Extract values related to relational data.
    const relations = _.pick(values, Order.associations.map(ast => ast.alias));
    const data = _.omit(values, Order.associations.map(ast => ast.alias));

    // Create entry with no-relational data.
    const entry = await Order.create(data);

    // Create relational data and return the entry.
    const order = await Order.updateRelations({ _id: entry.id, values: relations });

    // var message =
    //   `Code: ${order.code}\n` +
    //   `Delivery date: ${moment(order.delivery_date).format('DD MMM YYYY')}\n` +
    //   `Delivery address: ${order.delivery_address}\n` +
    //   `Phone: ${order.phone}\n` +
    //   `Recipient name: ${order.recipient_name}\n` +
    //   `Description: ${order.description}\n` +
    //   `User:\n` +
    //   `- Name: ${order.user.firstname} ${order.user.lastname}\n` +
    //   `- Phone: ${order.user.phone}\n` +
    //   `- Email: ${order.user.email}\n` +
    //   `Orderitems:\n`;
    // order.orderitems.forEach((item) => {
    //   message += ``
    // });

    // var subject = `*ABK ORDER ADDED*`;
    // axios.post(strapi.config.currentEnvironment.telegramWebHook, {
    //   text: `${subject}\n${message}\n`
    // });
    return order;
  },

  /**
   * Promise to checkout an order.
   *
   * @return {Promise}
   */

  checkout: async (values) => {
    const relations = _.pick(values, Order.associations.map(ast => ast.alias));
    const data = _.omit(values, Order.associations.map(ast => ast.alias));

    const orderitems = await Promise.all(
      values.items.map(async (i) => {
        let sku = await strapi.services.sku.findOne({ id: i.sku });
        let item = await strapi.services.orderitem.add({
          price: sku.price,
          sku: sku.id || sku._id,
          quantity: i.quantity,
          delivery_date: data.delivery_date,
        });
        item.sku = sku;
        return _.pick(item, ['id', 'sku', 'quantity']);
      })
    );

    data.code = shortid.generate();

    data.fee = _.sumBy(orderitems, i => i.sku.fee * i.quantity);

    relations.orderitems = orderitems.map(i => i.id);

    const entry = await Order.create(data);

    const order = await Order.updateRelations({ _id: entry.id, values: relations });
    
    return _.pick(order, ['code']);
  },

  /**
   * Promise to edit a/an order.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Extract values related to relational data.
    const relations = _.pick(values, Order.associations.map(a => a.alias));
    const data = _.omit(values, Order.associations.map(a => a.alias));

    // Update entry with no-relational data.
    const entry = await Order.updateOne(params, data, { multi: true });

    // Update relational data and return the entry.
    return Order.updateRelations(Object.assign(params, { values: relations }));
  },

  /**
   * Promise to remove a/an order.
   *
   * @return {Promise}
   */

  remove: async params => {
    // Select field to populate.
    const populate = Order.associations
      .filter(ast => ast.autoPopulate !== false)
      .map(ast => ast.alias)
      .join(' ');

    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Order
      .findOneAndRemove(params, {})
      .populate(populate);

    if (!data) {
      return data;
    }

    await Promise.all(
      Order.associations.map(async association => {
        if (!association.via || !data._id || association.dominant) {
          return true;
        }

        const search = _.endsWith(association.nature, 'One') || association.nature === 'oneToMany' ? { [association.via]: data._id } : { [association.via]: { $in: [data._id] } };
        const update = _.endsWith(association.nature, 'One') || association.nature === 'oneToMany' ? { [association.via]: null } : { $pull: { [association.via]: data._id } };

        // Retrieve model.
        const model = association.plugin ?
          strapi.plugins[association.plugin].models[association.model || association.collection] :
          strapi.models[association.model || association.collection];

        return model.update(search, update, { multi: true });
      })
    );

    return data;
  },

  /**
   * Promise to search a/an order.
   *
   * @return {Promise}
   */

  search: async (params) => {
    // Convert `params` object to filters compatible with Mongo.
    const filters = strapi.utils.models.convertParams('order', params);
    // Select field to populate.
    const populate = Order.associations
      .filter(ast => ast.autoPopulate !== false)
      .map(ast => ast.alias)
      .join(' ');

    const $or = Object.keys(Order.attributes).reduce((acc, curr) => {
      switch (Order.attributes[curr].type) {
        case 'integer':
        case 'float':
        case 'decimal':
          if (!_.isNaN(_.toNumber(params._q))) {
            return acc.concat({ [curr]: params._q });
          }

          return acc;
        case 'string':
        case 'text':
        case 'password':
          return acc.concat({ [curr]: { $regex: params._q, $options: 'i' } });
        case 'boolean':
          if (params._q === 'true' || params._q === 'false') {
            return acc.concat({ [curr]: params._q === 'true' });
          }

          return acc;
        default:
          return acc;
      }
    }, []);

    return Order
      .find({ $or })
      .sort(filters.sort)
      .skip(filters.start)
      .limit(filters.limit)
      .populate(populate);
  },

  fetchByOperator: async (params) => {
    // const filters = convertRestQueryParams();

    return buildQuery({
      model: Order,
      // filters,
      populate: [{
        path: "orderitems",
        populate: [{
          path: "product"
        }, {
          path: "where_to_buy_location"
        }, {
          path: "delivery_location"
        }, {
          path: "tasks"
        }]
      }, {
        path: "user"
      }],
    });
  }
};
