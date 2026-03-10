/**
 * Auth Middleware
 *
 * For now this injects a fixed customer_id = 1 so the API works
 * without a full auth system. The dev team should replace this
 * with their real session / JWT verification.
 */
module.exports = function auth(req, res, next) {
    // TODO: replace with real session/JWT check
    // e.g. verify req.headers.authorization or req.session.customerId
    req.customerId = 1;
    next();
};
