// /backend/src/modules/mycalendar/mycalendar.routes.js
const controller = require('./mycalendar.controller');
const { PERMISSIONS } = require('./mycalendar.permissions');

async function myCalendarRoutes(fastify, options) {
    const { authenticate } = options.authMiddleware;

    fastify.addHook('preHandler', authenticate);

    // Get all events (personal + shared + company if companyId header present)
    fastify.get('/events', controller.getEvents);
    
    // Get pending invitations
    fastify.get('/invitations', controller.getInvitations);
    
    // Create event
    fastify.post('/events', controller.createEvent);
    
    // Update/Delete
    fastify.put('/events/:id', controller.updateEvent);
    fastify.delete('/events/:id', controller.deleteEvent);
    
    // Upload image
    fastify.post('/events/:id/image', controller.uploadImage);
    
    // Share event
    fastify.post('/events/:id/share', controller.shareEvent);
    
    // Respond to invitation
    fastify.post('/invitations/:id/respond', controller.respondInvitation);
    
    // Categories
    fastify.get('/categories', controller.getCategories);
    fastify.post('/categories', controller.createCategory);
    fastify.delete('/categories/:id', controller.deleteCategory);
}

module.exports = {
    name: 'mycalendar',
    isDefault: true,
    routes: myCalendarRoutes
};
