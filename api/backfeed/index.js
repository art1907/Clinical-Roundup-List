const { app } = require('@azure/functions');
const DataService = require('../shared/dataService');

app.http('backfeed', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'patients/backfeed',
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
            const url = new URL(request.url);
            const mrn = url.searchParams.get('mrn');
            
            if (!mrn) {
                return {
                    status: 400,
                    body: JSON.stringify({ error: 'MRN parameter required' })
                };
            }
            
            // Get all patients with this MRN, sorted by date desc
            const patients = await dataService.getPatientsByMRN(mrn);
            
            if (patients.length === 0) {
                return {
                    status: 404,
                    body: JSON.stringify({ error: 'No previous visits found' })
                };
            }
            
            // Get most recent
            const previousVisit = patients[0];
            
            // Create backfeed data (copy all except date, findings, pending, followUp)
            const backfeedData = {
                room: previousVisit.room,
                name: previousVisit.name,
                dob: previousVisit.dob,
                mrn: previousVisit.mrn,
                hospital: previousVisit.hospital,
                plan: previousVisit.plan,
                supervisingMd: previousVisit.supervisingMd,
                priority: previousVisit.priority,
                procedureStatus: previousVisit.procedureStatus,
                cptPrimary: previousVisit.cptPrimary,
                icdPrimary: previousVisit.icdPrimary,
                chargeCodesSecondary: previousVisit.chargeCodesSecondary,
                lastVisitDate: previousVisit.date
            };
            
            // Log audit
            await dataService.logAudit({
                action: 'Backfeed Previous Visit',
                user: user.userId,
                actionType: 'READ',
                affectedRecords: previousVisit.visitKey,
                details: { mrn, lastVisitDate: previousVisit.date }
            });
            
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backfeedData)
            };
        } catch (error) {
            context.log('Error:', error);
            return {
                status: 500,
                body: JSON.stringify({ error: 'Internal server error', details: error.message })
            };
        }
    }
});
