const axios = require('axios');

const api = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    Authorization: `Bearer ${process.env.PRIVATE_APP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Ticket pipeline and starting stage. "0" and "1" are HubSpot's default
// Support Pipeline and its "New" stage. Change these if your current form
// puts tickets somewhere else.
const TICKET_PIPELINE = '0';
const TICKET_STAGE = '1';

exports.main = async (context) => {
  const params = context.parameters || {};

  try {
    if (params.action === 'search') return await searchCompanies(params.term);
    if (params.action === 'categories') return await getCategories();
    if (params.action === 'submit') return await createTicket(params);
    return fail(400, 'Unknown action.');
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || 'Unknown error';
    console.error('Request failed:', status, message);
    return fail(status, message);
  }
};

// Search companies by name, domain, or OTR Customer Code
async function searchCompanies(term) {
  if (!term || term.length < 2) return fail(400, 'Search term is required.');
  const wildcard = `*${term}*`;

  const { data } = await api.post('/crm/v3/objects/companies/search', {
    filterGroups: [
      { filters: [{ propertyName: 'name', operator: 'CONTAINS_TOKEN', value: wildcard }] },
      { filters: [{ propertyName: 'domain', operator: 'CONTAINS_TOKEN', value: wildcard }] },
      { filters: [{ propertyName: 'otr_customer_code', operator: 'CONTAINS_TOKEN', value: wildcard }] },
    ],
    properties: ['name', 'domain', 'otr_customer_code'],
    sorts: [{ propertyName: 'name', direction: 'ASCENDING' }],
    limit: 20,
  });

  const results = data.results.map((r) => ({
    id: r.id,
    name: r.properties.name,
    domain: r.properties.domain,
    code: r.properties.otr_customer_code,
  }));
  return ok({ results });
}

// Load the Category dropdown options from the ticket property
async function getCategories() {
  const { data } = await api.get('/crm/v3/properties/tickets/hs_ticket_category');
  const options = (data.options || [])
    .filter((o) => !o.hidden)
    .map((o) => ({ label: o.label, value: o.value }));
  return ok({ options });
}

// Find or create the contact, create the ticket, and link everything
async function createTicket(p) {
  // 1. Find the customer contact by email, or create it
  let contactId;
  let isNewContact = false;
  const found = await api.post('/crm/v3/objects/contacts/search', {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: p.email }] }],
    properties: ['email'],
    limit: 1,
  });
  if (found.data.results.length > 0) {
    contactId = found.data.results[0].id;
  } else {
    const created = await api.post('/crm/v3/objects/contacts', {
      properties: { email: p.email, firstname: p.firstName, lastname: p.lastName },
    });
    contactId = created.data.id;
    isNewContact = true;
  }

  // 2. Create the ticket
  const ticket = await api.post('/crm/v3/objects/tickets', {
    properties: {
      subject: p.ticketName,
      content: p.description,
      hs_ticket_category: p.category,
      purchase_order_number: p.orderNumber,
      order_branch: p.orderBranch,
      salesperson_email: p.salespersonEmail,
      hs_pipeline: TICKET_PIPELINE,
      hs_pipeline_stage: TICKET_STAGE,
    },
  });
  const ticketId = ticket.data.id;

  // 3. Link the ticket to the contact and company
  await api.put(`/crm/v4/objects/tickets/${ticketId}/associations/default/contacts/${contactId}`);
  if (p.companyId) {
    await api.put(`/crm/v4/objects/tickets/${ticketId}/associations/default/companies/${p.companyId}`);
    if (isNewContact) {
      await api.put(`/crm/v4/objects/contacts/${contactId}/associations/default/companies/${p.companyId}`);
    }
  }

  return ok({ ticketId });
}

function ok(body) {
  return { statusCode: 200, body: { success: true, ...body } };
}

function fail(statusCode, error) {
  return { statusCode, body: { success: false, error } };
}