const { app } = require('@azure/functions');
const DataService = require('../shared/dataService');

app.http('patients', {
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    authLevel: 'anonymous', // EasyAuth handles authentication
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
        
        const userRoles = user.userRoles || [];
        const method = request.method;
        
        try {
            switch (method) {
                case 'GET': {
                    const url = new URL(request.url);
                    const date = url.searchParams.get('date');
                    
                    const result = await dataService.getPatients(date);
                    
                    // Apply field masking for non-billing users
                    if (!userRoles.includes('billing') && !userRoles.includes('admin')) {
                        result.patients = result.patients.map(p => ({
                            ...p,
                            cptPrimary: '***',
                            icdPrimary: '***',
                            chargeCodesSecondary: '***'
                        }));
                    }
                    
                    // Log audit
                    await dataService.logAudit({
                        action: 'View Patients',
                        user: user.userId,
                        actionType: 'READ',
                        affectedRecords: `${result.patients.length} patients`,
                        details: { date }
                    });
                    
                    return {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(result)
                    };
                }
                
                case 'POST': {
                    // Check permission
                    if (!userRoles.includes('clinician') && !userRoles.includes('admin')) {
                        return {
                            status: 403,
                            body: JSON.stringify({ error: 'Insufficient permissions' })
                        };
                    }
                    
                    const patientData = await request.json();
                    const newPatient = await dataService.createPatient(patientData);
                    
                    // Log audit
                    await dataService.logAudit({
                        action: 'Create Patient',
                        user: user.userId,
                        actionType: 'CREATE',
                        affectedRecords: newPatient.visitKey,
                        details: { room: patientData.room, name: patientData.name }
                    });
                    
                    return {
                        status: 201,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newPatient)
                    };
                }
                
                case 'PUT': {
                    // Check permission
                    if (!userRoles.includes('clinician') && !userRoles.includes('admin')) {
                        return {
                            status: 403,
                            body: JSON.stringify({ error: 'Insufficient permissions' })
                        };
                    }
                    
                    const url = new URL(request.url);
                    const itemId = url.pathname.split('/').pop();
                    const patientData = await request.json();
                    
                    const updatedPatient = await dataService.updatePatient(itemId, patientData);
                    
                    // Log audit
                    await dataService.logAudit({
                        action: 'Update Patient',
                        user: user.userId,
                        actionType: 'UPDATE',
                        affectedRecords: updatedPatient.visitKey,
                        details: { itemId, changes: patientData }
                    });
                    
                    return {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedPatient)
                    };
                }
                
                case 'DELETE': {
                    // Check permission - only admins can delete
                    if (!userRoles.includes('admin')) {
                        return {
                            status: 403,
                            body: JSON.stringify({ error: 'Only administrators can delete records' })
                        };
                    }
                    
                    const url = new URL(request.url);
                    const itemId = url.pathname.split('/').pop();
                    
                    await dataService.deletePatient(itemId);
                    
                    // Log audit
                    await dataService.logAudit({
                        action: 'Delete Patient',
                        user: user.userId,
                        actionType: 'DELETE',
                        affectedRecords: itemId,
                        details: { itemId }
                    });
                    
                    return {
                        status: 204
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
            
            if (error.statusCode === 409) {
                return {
                    status: 409,
                    body: JSON.stringify({ error: error.message })
                };
            }
            
            return {
                status: 500,
                body: JSON.stringify({ error: 'Internal server error', details: error.message })
            };
        }
    }
});
