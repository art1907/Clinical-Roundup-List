const { app } = require('@azure/functions');
const DataService = require('../shared/dataService');

app.http('settings', {
    methods: ['GET', 'PUT'],
    authLevel: 'anonymous',
    route: 'settings',
    handler: async (request, context) => {
        const dataService = new DataService();
        
        // Get user from EasyAuth
        const clientPrincipal = request.headers.get('x-ms-client-principal');
        const user = clientPrincipal ? JSON.parse(Buffer.from(clientPrincipal, 'base64').toString()) : null;
        
        if (!user) {
            return {
                status: 401,
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }
        
        const method = request.method;
        
        try {
            switch (method) {
                case 'GET': {
                    const settings = await dataService.getSettings();
                    
                    return {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(settings)
                    };
                }
                
                case 'PUT': {
                    const userRoles = user.userRoles || [];
                    
                    // Check permission
                    if (!userRoles.includes('admin')) {
                        return {
                            status: 403,
                            body: JSON.stringify({ error: 'Only administrators can modify settings' })
                        };
                    }
                    
                    const settingsData = await request.json();
                    const saved = await dataService.updateSettings(settingsData);
                    
                    // Log audit
                    await dataService.logAudit({
                        action: 'Update Settings',
                        user: user.userId,
                        actionType: 'UPDATE',
                        affectedRecords: 'global',
                        details: settingsData
                    });
                    
                    return {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(saved)
                    };
                }
                
                default:
                    return {
                        status: 405,
                        body: JSON.stringify({ error: 'Method not allowed' })
                    };
            }
        } catch (error) {
            context.log('Error:', error);
            return {
                status: 500,
                body: JSON.stringify({ error: 'Internal server error', details: error.message })
            };
        }
    }
});
