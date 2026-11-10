import { createContext, useContext, useEffect, useState } from 'react';
import {
  hubspot,
  Flex,
  Box,
  Input,
  TextArea,
  Select,
  Button,
  Text,
  Link,
  Alert,
  Divider,
  LoadingSpinner,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@hubspot/ui-extensions';
import { PageTitle } from '@hubspot/ui-extensions/pages';

// Pages.tsx fills this in so the form knows who is logged in
export const AppContext = createContext<any>(null);

const DEFAULT_TICKET_NAME = 'New Customer Care Request';

export const HomePage = () => {
  const app = useContext(AppContext);
  const portalId = app?.context?.portal?.id;
  const userEmail = app?.context?.user?.email || '';

  // Message banner at the top of the form
  const [message, setMessage] = useState<any>(null);

  // Customer fields
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Company search
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [company, setCompany] = useState<any>(null);

  // Ticket fields
  const [categoryOptions, setCategoryOptions] = useState<any[]>([]);
  const [category, setCategory] = useState('');
  const [ticketName, setTicketName] = useState(DEFAULT_TICKET_NAME);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderBranch, setOrderBranch] = useState('');
  const [description, setDescription] = useState('');
  const [salespersonEmail, setSalespersonEmail] = useState(userEmail);

  const [submitting, setSubmitting] = useState(false);

  // Load the Category dropdown choices from HubSpot
  useEffect(() => {
    hubspot
      .serverless('OTRCOSearch_app_function', { parameters: { action: 'categories' } })
      .then((res: any) => {
        if (res.body.success) {
          setCategoryOptions(res.body.options);
          if (res.body.options.length === 0) {
            setMessage({ variant: 'warning', title: 'No categories found', text: 'The Category property has no options in this account.' });
          }
        } else {
          setMessage({ variant: 'danger', title: 'Could not load categories', text: res.body.error });
        }
      })
      .catch((err: any) => {
        setMessage({ variant: 'danger', title: 'Could not load categories', text: err.message });
      });
  }, []);

  const runSearch = async () => {
    if (searchTerm.trim().length < 2) {
      setMessage({ variant: 'warning', title: 'Type at least 2 characters to search.' });
      return;
    }
    setMessage(null);
    setSearching(true);
    try {
      const res: any = await hubspot.serverless('OTRCOSearch_app_function', {
        parameters: { action: 'search', term: searchTerm.trim() },
      });
      if (res.body.success) {
        setResults(res.body.results);
        setSearched(true);
      } else {
        setMessage({ variant: 'danger', title: 'Search failed', text: res.body.error });
      }
    } catch (err: any) {
      setMessage({ variant: 'danger', title: 'Search failed', text: err.message });
    } finally {
      setSearching(false);
    }
  };

  const pickCompany = (c: any) => {
    setCompany(c);
    setResults([]);
    setSearched(false);
    setSearchTerm('');
  };

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setCompany(null);
    setCategory('');
    setTicketName(DEFAULT_TICKET_NAME);
    setOrderNumber('');
    setOrderBranch('');
    setDescription('');
    setSalespersonEmail(userEmail);
  };

  const submit = async () => {
    const missing: string[] = [];
    if (!email.trim()) missing.push('Customer email');
    if (!firstName.trim()) missing.push('Customer first name');
    if (!lastName.trim()) missing.push('Customer last name');
    if (!category) missing.push('Category');
    if (!description.trim()) missing.push('Ticket description');
    if (!salespersonEmail.trim()) missing.push('Salesperson email');
    if (missing.length) {
      setMessage({ variant: 'warning', title: 'Fill in the required fields', text: missing.join(', ') });
      return;
    }

    setMessage(null);
    setSubmitting(true);
    try {
      const res: any = await hubspot.serverless('OTRCOSearch_app_function', {
        parameters: {
          action: 'submit',
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          companyId: company?.id || null,
          category,
          ticketName: ticketName.trim() || DEFAULT_TICKET_NAME,
          orderNumber: orderNumber.trim(),
          orderBranch: orderBranch.trim(),
          description: description.trim(),
          salespersonEmail: salespersonEmail.trim(),
        },
      });
      if (res.body.success) {
        setMessage({ variant: 'success', title: 'Ticket created', ticketId: res.body.ticketId });
        resetForm();
      } else {
        setMessage({ variant: 'danger', title: 'Ticket not created', text: res.body.error });
      }
    } catch (err: any) {
      setMessage({ variant: 'danger', title: 'Ticket not created', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageTitle>Customer Care Request</PageTitle>

      <Flex direction="column" gap="md">
        {message && (
          <Alert title={message.title} variant={message.variant}>
            {message.text}
            {message.ticketId && portalId && (
              <Link href={`https://app.hubspot.com/contacts/${portalId}/record/0-5/${message.ticketId}`}>
                Open the ticket
              </Link>
            )}
          </Alert>
        )}

        <Input name="email" label="Customer email" required value={email} onChange={(v: string) => setEmail(v)} />
        <Flex direction="row" gap="sm">
          <Box flex={1}>
            <Input name="firstName" label="Customer first name" required value={firstName} onChange={(v: string) => setFirstName(v)} />
          </Box>
          <Box flex={1}>
            <Input name="lastName" label="Customer last name" required value={lastName} onChange={(v: string) => setLastName(v)} />
          </Box>
        </Flex>

        <Divider />

        {/* Company lookup */}
        {company ? (
          <Flex direction="column" gap="xs">
            <Flex direction="row" gap="sm">
              <Box flex={1}>
                <Input name="companyName" label="Company name" readOnly value={company.name || ''} />
              </Box>
              <Box flex={1}>
                <Input name="customerCode" label="OTR Customer Code" readOnly value={company.code || ''} />
              </Box>
            </Flex>
            <Button variant="secondary" size="xs" onClick={() => setCompany(null)}>
              Change company
            </Button>
          </Flex>
        ) : (
          <Flex direction="column" gap="sm">
            <Flex direction="row" gap="sm" align="end">
              <Box flex={1}>
                <Input
                  name="companySearch"
                  label="Find company"
                  description="Search by company name, website, or OTR Customer Code"
                  placeholder="Start typing a company name or code"
                  value={searchTerm}
                  onChange={(v: string) => setSearchTerm(v)}
                />
              </Box>
              <Button onClick={runSearch} disabled={searching}>
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </Flex>

            {searching && <LoadingSpinner label="Searching companies" />}

            {!searching && searched && results.length === 0 && (
              <Text>No companies match that search. Try fewer letters or the customer code.</Text>
            )}

            {!searching && results.length > 0 && (
              <Table bordered={true}>
                <TableHead>
                  <TableRow>
                    <TableHeader>Company</TableHeader>
                    <TableHeader>OTR Customer Code</TableHeader>
                    <TableHeader>Domain</TableHeader>
                    <TableHeader> </TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name || '(no name)'}</TableCell>
                      <TableCell>{c.code || '—'}</TableCell>
                      <TableCell>{c.domain || '—'}</TableCell>
                      <TableCell>
                        <Button size="xs" onClick={() => pickCompany(c)}>
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Flex>
        )}

        <Divider />

        <Select
          name="category"
          label="Category"
          required
          placeholder="Please select"
          options={categoryOptions}
          value={category}
          onChange={(v: any) => setCategory(v)}
        />
        <Input name="ticketName" label="Ticket name" value={ticketName} onChange={(v: string) => setTicketName(v)} />
        <Flex direction="row" gap="sm">
          <Box flex={1}>
            <Input name="orderNumber" label="Purchase Order number" value={orderNumber} onChange={(v: string) => setOrderNumber(v)} />
          </Box>
          <Box flex={1}>
            <Input name="orderBranch" label="Order Branch" value={orderBranch} onChange={(v: string) => setOrderBranch(v)} />
          </Box>
        </Flex>
        <TextArea
          name="description"
          label="Ticket description"
          required
          value={description}
          onChange={(v: string) => setDescription(v)}
        />
        <Input
          name="salespersonEmail"
          label="Salesperson email"
          required
          value={salespersonEmail}
          onChange={(v: string) => setSalespersonEmail(v)}
        />

        <Flex direction="row" gap="sm">
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Creating ticket…' : 'Create ticket'}
          </Button>
        </Flex>
      </Flex>
    </>
  );
};