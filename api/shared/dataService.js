/**
 * Data Access Layer for SharePoint Lists
 * Provides abstraction for easy migration to Cosmos DB later
 */

const { Client } = require('@microsoft/microsoft-graph-client');
const { DefaultAzureCredential } = require('@azure/identity');
require('isomorphic-fetch');

class DataService {
    constructor() {
        this.credential = new DefaultAzureCredential();
        this.graphClient = null;
        this.siteId = process.env.SHAREPOINT_SITE_ID;
        this.patientsListId = process.env.PATIENTS_LIST_ID;
        this.onCallListId = process.env.ONCALL_LIST_ID;
        this.settingsListId = process.env.SETTINGS_LIST_ID;
        this.auditListId = process.env.AUDIT_LIST_ID;
    }

    async getGraphClient() {
        if (!this.graphClient) {
            const token = await this.credential.getToken('https://graph.microsoft.com/.default');
            this.graphClient = Client.init({
                authProvider: (done) => {
                    done(null, token.token);
                }
            });
        }
        return this.graphClient;
    }

    /**
     * Retry with exponential backoff for Graph API throttling (429)
     */
    async retryWithBackoff(operation, maxRetries = 3) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (error.statusCode === 429 && attempt < maxRetries - 1) {
                    const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }

    /**
     * Get all patients, optionally filtered by date
     */
    async getPatients(date = null) {
        const client = await this.getGraphClient();
        
        return this.retryWithBackoff(async () => {
            let query = `/sites/${this.siteId}/lists/${this.patientsListId}/items?$expand=fields`;
            
            if (date) {
                query += `&$filter=fields/Date eq '${date}'`;
            }
            
            const response = await client.api(query).get();
            
            // Convert SharePoint list items to patient objects
            const patients = response.value.map(item => this.mapListItemToPatient(item));
            
            // Get max lastUpdated timestamp
            const lastUpdatedMax = patients.length > 0 
                ? Math.max(...patients.map(p => new Date(p.lastUpdated).getTime()))
                : 0;
            
            return {
                patients,
                lastUpdatedMax: new Date(lastUpdatedMax).toISOString()
            };
        });
    }

    /**
     * Get patient by ID (VisitKey = mrn|date)
     */
    async getPatient(visitKey) {
        const client = await this.getGraphClient();
        
        return this.retryWithBackoff(async () => {
            const query = `/sites/${this.siteId}/lists/${this.patientsListId}/items?$expand=fields&$filter=fields/VisitKey eq '${visitKey}'`;
            const response = await client.api(query).get();
            
            if (response.value.length === 0) return null;
            
            return this.mapListItemToPatient(response.value[0]);
        });
    }

    /**
     * Get patients by MRN for backfeed
     */
    async getPatientsByMRN(mrn) {
        const client = await this.getGraphClient();
        
        return this.retryWithBackoff(async () => {
            const query = `/sites/${this.siteId}/lists/${this.patientsListId}/items?$expand=fields&$filter=fields/MRN eq '${mrn}'&$orderby=fields/Date desc`;
            const response = await client.api(query).get();
            
            return response.value.map(item => this.mapListItemToPatient(item));
        });
    }

    /**
     * Create new patient record
     */
    async createPatient(patientData) {
        const client = await this.getGraphClient();
        
        // Build VisitKey for uniqueness
        const visitKey = `${patientData.mrn}|${patientData.date}`;
        
        // Check for existing record
        const existing = await this.getPatient(visitKey);
        if (existing) {
            throw { statusCode: 409, message: `Patient already rounded on ${patientData.date}` };
        }
        
        return this.retryWithBackoff(async () => {
            const listItem = this.mapPatientToListItem(patientData, visitKey);
            
            const response = await client
                .api(`/sites/${this.siteId}/lists/${this.patientsListId}/items`)
                .post({ fields: listItem });
            
            return this.mapListItemToPatient(response);
        });
    }

    /**
     * Update existing patient record
     */
    async updatePatient(itemId, patientData) {
        const client = await this.getGraphClient();
        
        return this.retryWithBackoff(async () => {
            const listItem = this.mapPatientToListItem(patientData);
            
            const response = await client
                .api(`/sites/${this.siteId}/lists/${this.patientsListId}/items/${itemId}`)
                .patch({ fields: listItem });
            
            return this.mapListItemToPatient(response);
        });
    }

    /**
     * Delete patient record
     */
    async deletePatient(itemId) {
        const client = await this.getGraphClient();
        
        return this.retryWithBackoff(async () => {
            await client
                .api(`/sites/${this.siteId}/lists/${this.patientsListId}/items/${itemId}`)
                .delete();
        });
    }

    /**
     * Get on-call schedule
     */
    async getOnCallSchedule() {
        const client = await this.getGraphClient();
        
        return this.retryWithBackoff(async () => {
            const response = await client
                .api(`/sites/${this.siteId}/lists/${this.onCallListId}/items?$expand=fields`)
                .get();
            
            return response.value.map(item => ({
                id: item.id,
                date: item.fields.Date,
                provider: item.fields.Provider,
                hospitals: item.fields.Hospitals
            }));
        });
    }

    /**
     * Create or update on-call record
     */
    async saveOnCallSchedule(scheduleData) {
        const client = await this.getGraphClient();
        
        return this.retryWithBackoff(async () => {
            // Check if record exists for this date
            const query = `/sites/${this.siteId}/lists/${this.onCallListId}/items?$expand=fields&$filter=fields/Date eq '${scheduleData.date}'`;
            const existing = await client.api(query).get();
            
            const listItem = {
                Date: scheduleData.date,
                Provider: scheduleData.provider,
                Hospitals: scheduleData.hospitals
            };
            
            if (existing.value.length > 0) {
                // Update
                return await client
                    .api(`/sites/${this.siteId}/lists/${this.onCallListId}/items/${existing.value[0].id}`)
                    .patch({ fields: listItem });
            } else {
                // Create
                return await client
                    .api(`/sites/${this.siteId}/lists/${this.onCallListId}/items`)
                    .post({ fields: listItem });
            }
        });
    }

    /**
     * Get global settings
     */
    async getSettings() {
        const client = await this.getGraphClient();
        
        return this.retryWithBackoff(async () => {
            const response = await client
                .api(`/sites/${this.siteId}/lists/${this.settingsListId}/items?$expand=fields`)
                .get();
            
            if (response.value.length === 0) {
                return { onCall: '', hospitals: '', complianceMode: 'relaxed' };
            }
            
            const fields = response.value[0].fields;
            return {
                id: response.value[0].id,
                onCall: fields.OnCall || '',
                hospitals: fields.Hospitals || '',
                complianceMode: fields.ComplianceMode || 'relaxed'
            };
        });
    }

    /**
     * Update global settings
     */
    async updateSettings(settings) {
        const client = await this.getGraphClient();
        
        return this.retryWithBackoff(async () => {
            const currentSettings = await this.getSettings();
            
            const listItem = {
                OnCall: settings.onCall,
                Hospitals: settings.hospitals,
                ComplianceMode: settings.complianceMode || 'relaxed'
            };
            
            if (currentSettings.id) {
                // Update
                return await client
                    .api(`/sites/${this.siteId}/lists/${this.settingsListId}/items/${currentSettings.id}`)
                    .patch({ fields: listItem });
            } else {
                // Create
                return await client
                    .api(`/sites/${this.siteId}/lists/${this.settingsListId}/items`)
                    .post({ fields: listItem });
            }
        });
    }

    /**
     * Log audit event
     */
    async logAudit(auditData) {
        const client = await this.getGraphClient();
        
        return this.retryWithBackoff(async () => {
            const listItem = {
                Title: auditData.action,
                UserIdentity: auditData.user,
                ActionType: auditData.actionType,
                AffectedRecords: auditData.affectedRecords || '',
                Timestamp: new Date().toISOString(),
                Details: JSON.stringify(auditData.details || {})
            };
            
            await client
                .api(`/sites/${this.siteId}/lists/${this.auditListId}/items`)
                .post({ fields: listItem });
        });
    }

    // Helper: Map SharePoint list item to patient object
    mapListItemToPatient(item) {
        const fields = item.fields;
        
        // Parse JSON fields
        const findingsData = fields.FindingsData ? JSON.parse(fields.FindingsData) : { codes: [], values: {} };
        
        return {
            id: item.id,
            visitKey: fields.VisitKey,
            room: fields.Room || '',
            date: fields.Date,
            name: fields.Name || '',
            dob: fields.DOB || '',
            mrn: fields.MRN || '',
            hospital: fields.Hospital || '',
            findingsCodes: findingsData.codes || [],
            findingsValues: findingsData.values || {},
            findingsText: fields.FindingsText || '',
            plan: fields.Plan || '',
            supervisingMd: fields.SupervisingMD || '',
            pending: fields.Pending || '',
            followUp: fields.FollowUp || '',
            priority: fields.Priority === 'Yes',
            procedureStatus: fields.ProcedureStatus || 'To-Do',
            cptPrimary: fields.CPTPrimary || '',
            icdPrimary: fields.ICDPrimary || '',
            chargeCodesSecondary: fields.ChargeCodesSecondary || '',
            archived: fields.Archived === 'Yes',
            lastUpdated: fields.Modified || new Date().toISOString()
        };
    }

    // Helper: Map patient object to SharePoint list item
    mapPatientToListItem(patient, visitKey = null) {
        // Combine findingsCodes and findingsValues into single JSON blob
        const findingsData = JSON.stringify({
            codes: patient.findingsCodes || [],
            values: patient.findingsValues || {}
        });
        
        const item = {
            Room: patient.room || '',
            Date: patient.date,
            Name: patient.name || '',
            DOB: patient.dob || '',
            MRN: patient.mrn || '',
            Hospital: patient.hospital || '',
            FindingsData: findingsData,
            FindingsText: patient.findingsText || '',
            Plan: patient.plan || '',
            SupervisingMD: patient.supervisingMd || '',
            Pending: patient.pending || '',
            FollowUp: patient.followUp || '',
            Priority: patient.priority ? 'Yes' : 'No',
            ProcedureStatus: patient.procedureStatus || 'To-Do',
            CPTPrimary: patient.cptPrimary || '',
            ICDPrimary: patient.icdPrimary || '',
            ChargeCodesSecondary: patient.chargeCodesSecondary || '',
            Archived: patient.archived ? 'Yes' : 'No'
        };
        
        if (visitKey) {
            item.VisitKey = visitKey;
        }
        
        return item;
    }
}

module.exports = DataService;
