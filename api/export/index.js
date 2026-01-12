const { app } = require('@azure/functions');
const DataService = require('../shared/dataService');
const { Client } = require('@microsoft/microsoft-graph-client');

app.http('export', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'export',
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
        
        try {
            // Get the Excel file as base64 from request
            const body = await request.json();
            const { fileContent, fileName } = body;
            
            if (!fileContent || !fileName) {
                return {
                    status: 400,
                    body: JSON.stringify({ error: 'fileContent and fileName required' })
                };
            }
            
            // Convert base64 to buffer
            const buffer = Buffer.from(fileContent, 'base64');
            
            // Get Graph client with user's token
            const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');
            
            if (!accessToken) {
                return {
                    status: 401,
                    body: JSON.stringify({ error: 'Access token required' })
                };
            }
            
            const graphClient = Client.init({
                authProvider: (done) => {
                    done(null, accessToken);
                }
            });
            
            // Upload to OneDrive - versioned file
            const versionedPath = `/Clinical Rounding/${fileName}`;
            await graphClient
                .api(`/me/drive/root:${versionedPath}:/content`)
                .put(buffer);
            
            // Also upload as "Latest" for convenience
            const latestPath = `/Clinical Rounding/Rounding List - Latest.xlsx`;
            await graphClient
                .api(`/me/drive/root:${latestPath}:/content`)
                .put(buffer);
            
            // Log audit
            await dataService.logAudit({
                action: 'Export to OneDrive',
                user: user.userId,
                actionType: 'EXPORT',
                affectedRecords: fileName,
                details: { fileName, path: versionedPath }
            });
            
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: true, 
                    fileName,
                    paths: [versionedPath, latestPath]
                })
            };
        } catch (error) {
            context.log('Error:', error);
            return {
                status: 500,
                body: JSON.stringify({ error: 'Export failed', details: error.message })
            };
        }
    }
});
