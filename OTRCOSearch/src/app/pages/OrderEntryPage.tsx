import { useContext, useEffect, useState } from 'react';
import {
  hubspot,
  Flex,
  Box,
  Input,
  SearchInput,
  TextArea,
  Select,
  DateInput,
  NumberInput,
  CurrencyInput,
  Button,
  Text,
  Link,
  Alert,
  Divider,
  Heading,
  LoadingSpinner,
  Statistics,
  StatisticsItem,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@hubspot/ui-extensions';
import { PageTitle } from '@hubspot/ui-extensions/pages';
import { AppContext } from './HomePage.tsx';

const FN = 'OTRCOSearch_app_function';
const FORM_TITLE = 'Order Entry Request AFT';
const FORM_ID = 'OTR-6F-013';
const FORM_FOOTER = 'Rev A · Nov 12, 2025 · Approver: John King';
const OTHER = '__other__';

const toOptions = (values: string[]) => values.map((v) => ({ label: v, value: v }));

const BRANCHES = toOptions([
  '18-MS', '19-GE', '20-TM', '21-SC', '26-JA', '46-KU', '58-RO', '60-RO', 'AZPX01A-AZ',
  'CD-CD', 'CO01-DN', 'KS01-HS', 'NE01-NE', 'NE02-NE AF', 'R1-RO', 'R2-QY', 'SW-JA', 'TX01-TX',
]);
const SALES_PEOPLE = toOptions([
  'AST', 'BHO', 'BLE', 'BSH', 'CBA', 'CBE', 'CRH', 'EHI', 'GSV',
  'GWH', 'MAR', 'MCO', 'MSK', 'NZA', 'SSU', 'THE', 'ZPA',
]);
const SHIP_VIA = [
  ...toOptions([
    'Dayton Freight', 'Dohrn', 'Estes', 'FedEx Freight', 'FedEx Ground', 'FedEx ND Air',
    'NM Transfer', 'Old Dominion', 'UPS Freight', 'UPS Ground', 'UPS ND Air', 'USF Holland',
    'XPO Logistics', 'YRC Freight',
  ]),
  { label: 'Other', value: OTHER },
];
const SHIPPING_TERMS = [
  ...toOptions(['PPD', 'PPD & ADD', 'COLLECT', 'CPU', '3RD PARTY BILL RT']),
  { label: 'Other', value: OTHER },
];

interface Line {
  key: number;
  partNumber: string;
  description: string;
  qty: number;
  price: number;
  cost: number;
  discount: number;
  color: string;
  notes: string;
}

let nextKey = 1;
const blankLine = (): Line => ({
  key: nextKey++,
  partNumber: '',
  description: '',
  qty: 1,
  price: 0,
  cost: 0,
  discount: 0,
  color: '',
  notes: '',
});

const num = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : 0);
const lineTotal = (l: Line) => num(l.qty) * num(l.price) - num(l.discount);
const lineCost = (l: Line) => num(l.qty) * num(l.cost);
const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const formatDate = (d: any) =>
  d ? `${String(d.month + 1).padStart(2, '0')}/${String(d.date).padStart(2, '0')}/${d.year}` : '';

// Runs a serverless search a short pause after the user stops typing
const useTypeAhead = (action: string, term: string) => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) {
      setResults([]);
      setError('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res: any = await hubspot.serverless(FN, { parameters: { action, term: t } });
        if (cancelled) return;
        if (res.body.success) {
          setResults(res.body.results);
          setError('');
        } else {
          setError(res.body.error);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [action, term]);

  return { results, loading, error, clear: () => setResults([]) };
};

// Two equal columns
const Row = ({ children }: { children: any[] }) => (
  <Flex direction="row" gap="md">
    {children.map((child, i) => (
      <Box key={i} flex={1}>
        {child}
      </Box>
    ))}
  </Flex>
);

export const OrderEntryPage = () => {
  const app = useContext(AppContext);
  const portalId = app?.context?.portal?.id;

  const [message, setMessage] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Customer
  const [companyTerm, setCompanyTerm] = useState('');
  const [company, setCompany] = useState<any>(null);
  const companySearch = useTypeAhead('search', company ? '' : companyTerm);

  // Order fields
  const [email, setEmail] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [branch, setBranch] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [shipDate, setShipDate] = useState<any>(null);
  const [salesPerson, setSalesPerson] = useState('');
  const [shipVia, setShipVia] = useState('');
  const [shipViaOther, setShipViaOther] = useState('');
  const [terms, setTerms] = useState('');
  const [termsOther, setTermsOther] = useState('');
  const [shipTo, setShipTo] = useState('');
  const [blindShipTo, setBlindShipTo] = useState('');
  const [instructions, setInstructions] = useState('');

  // Line items
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const activePart = lines.find((l) => l.key === activeLine)?.partNumber || '';
  const productSearch = useTypeAhead('searchProducts', activeLine === null ? '' : activePart);

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: number) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : [blankLine()]));
    if (activeLine === key) setActiveLine(null);
  };
  const pickProduct = (p: any) => {
    if (activeLine === null) return;
    updateLine(activeLine, {
      partNumber: p.sku || p.name || '',
      description: p.description || p.name || '',
      price: num(Number(p.price)),
      cost: num(Number(p.cost)),
    });
    setActiveLine(null);
  };

  const orderTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const totalCost = lines.reduce((s, l) => s + lineCost(l), 0);
  const marginAmt = orderTotal - totalCost;
  const marginPct = orderTotal ? (marginAmt / orderTotal) * 100 : 0;

  const pickCompany = (c: any) => {
    setCompany(c);
    setCompanyTerm('');
    companySearch.clear();
  };

  const resetForm = () => {
    setCompany(null);
    setCompanyTerm('');
    setEmail('');
    setPoNumber('');
    setBranch('');
    setTaxNumber('');
    setShipDate(null);
    setSalesPerson('');
    setShipVia('');
    setShipViaOther('');
    setTerms('');
    setTermsOther('');
    setShipTo('');
    setBlindShipTo('');
    setInstructions('');
    setLines([blankLine()]);
    setActiveLine(null);
  };

  const submit = async () => {
    const filledLines = lines.filter((l) => l.partNumber.trim() || l.description.trim());
    const missing: string[] = [];
    if (!company) missing.push('Customer ID/Name');
    if (!email.trim()) missing.push('Customer Email');
    if (!branch) missing.push('Order Branch');
    if (!salesPerson) missing.push('Sales Person');
    if (filledLines.length === 0) missing.push('At least one line item');
    if (missing.length) {
      setMessage({ variant: 'warning', title: 'Fill in the required fields', text: missing.join(', ') });
      return;
    }

    setMessage(null);
    setSubmitting(true);
    try {
      const res: any = await hubspot.serverless(FN, {
        parameters: {
          action: 'submitOrder',
          formId: FORM_ID,
          companyId: company.id,
          customerName: company.name || '',
          customerNumber: company.code || '',
          email: email.trim(),
          poNumber: poNumber.trim(),
          branch,
          taxNumber: taxNumber.trim(),
          shipDate: formatDate(shipDate),
          salesPerson,
          shipVia: shipVia === OTHER ? shipViaOther.trim() : shipVia,
          terms: terms === OTHER ? termsOther.trim() : terms,
          shipTo: shipTo.trim(),
          blindShipTo: blindShipTo.trim(),
          instructions: instructions.trim(),
          lines: filledLines.map((l) => ({
            partNumber: l.partNumber.trim(),
            description: l.description.trim(),
            qty: num(l.qty),
            price: num(l.price),
            cost: num(l.cost),
            discount: num(l.discount),
            color: l.color.trim(),
            notes: l.notes.trim(),
            total: lineTotal(l),
          })),
          orderTotal,
          totalCost,
          marginAmt,
          marginPct,
        },
      });
      if (res.body.success) {
        setMessage({ variant: 'success', title: 'Order request submitted', ticketId: res.body.ticketId });
        resetForm();
      } else {
        setMessage({ variant: 'danger', title: 'Order request not submitted', text: res.body.error });
      }
    } catch (err: any) {
      setMessage({ variant: 'danger', title: 'Order request not submitted', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageTitle>{FORM_TITLE}</PageTitle>

      <Flex direction="column" gap="md">
        <Text variant="microcopy">Form {FORM_ID}</Text>

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

        {/* Customer ID/Name + Customer Number */}
        <Row>
          {company ? (
            <Flex direction="column" gap="xs">
              <Input name="customer" label="Customer ID/Name" required readOnly value={company.name || ''} />
              <Button variant="secondary" size="xs" onClick={() => setCompany(null)}>
                Change customer
              </Button>
            </Flex>
          ) : (
            <Flex direction="column" gap="xs">
              <SearchInput
                name="customerSearch"
                label="Customer ID/Name"
                required
                placeholder="Type a company name or customer code"
                value={companyTerm}
                onInput={(v: string) => setCompanyTerm(v)}
                onChange={(v: string) => setCompanyTerm(v)}
              />
              {companySearch.loading && <LoadingSpinner size="xs" label="Searching" />}
              {companySearch.error && <Text variant="microcopy">Search failed: {companySearch.error}</Text>}
              {!companySearch.loading && companyTerm.trim().length >= 2 && companySearch.results.length === 0 && !companySearch.error && (
                <Text variant="microcopy">No matching companies.</Text>
              )}
              {companySearch.results.length > 0 && (
                <Table bordered={true}>
                  <TableBody>
                    {companySearch.results.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name || '(no name)'}</TableCell>
                        <TableCell>{c.code || '—'}</TableCell>
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
          <Input
            name="customerNumber"
            label="Customer Number"
            readOnly
            description="Filled from the company's OTR Customer Code"
            value={company?.code || ''}
          />
        </Row>

        <Row>
          <Input name="email" label="Customer Email" required value={email} onChange={(v: string) => setEmail(v)} />
          <Input name="poNumber" label="Customer PO Number" value={poNumber} onChange={(v: string) => setPoNumber(v)} />
        </Row>

        <Row>
          <Select
            name="branch"
            label="Order Branch"
            required
            placeholder="Select a branch"
            options={BRANCHES}
            value={branch}
            onChange={(v: any) => setBranch(v)}
          />
          <Input name="taxNumber" label="Tax Number" value={taxNumber} onChange={(v: string) => setTaxNumber(v)} />
        </Row>

        <Row>
          <DateInput name="shipDate" label="Ship Date" format="short" value={shipDate} onChange={(v: any) => setShipDate(v)} />
          <Select
            name="salesPerson"
            label="Sales Person"
            required
            placeholder="Select a sales person"
            options={SALES_PEOPLE}
            value={salesPerson}
            onChange={(v: any) => setSalesPerson(v)}
          />
        </Row>

        <Row>
          <Flex direction="column" gap="xs">
            <Select
              name="shipVia"
              label="Ship Via"
              placeholder="Select a carrier"
              options={SHIP_VIA}
              value={shipVia}
              onChange={(v: any) => setShipVia(v)}
            />
            {shipVia === OTHER && (
              <Input name="shipViaOther" label="Other carrier" value={shipViaOther} onChange={(v: string) => setShipViaOther(v)} />
            )}
          </Flex>
          <Flex direction="column" gap="xs">
            <Select
              name="terms"
              label="Shipping Terms"
              placeholder="Select terms"
              options={SHIPPING_TERMS}
              value={terms}
              onChange={(v: any) => setTerms(v)}
            />
            {terms === OTHER && (
              <Input name="termsOther" label="Other terms" value={termsOther} onChange={(v: string) => setTermsOther(v)} />
            )}
          </Flex>
        </Row>

        <Row>
          <TextArea name="shipTo" label="Ship To Address" rows={3} value={shipTo} onChange={(v: string) => setShipTo(v)} />
          <TextArea
            name="blindShipTo"
            label="Blind Ship To Address"
            rows={3}
            value={blindShipTo}
            onChange={(v: string) => setBlindShipTo(v)}
          />
        </Row>

        <Divider />

        {/* Line items */}
        <Heading>Line items</Heading>
        <Table bordered={true}>
          <TableHead>
            <TableRow>
              <TableHeader>Part Number</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Qty</TableHeader>
              <TableHeader>Price</TableHeader>
              <TableHeader>Cost</TableHeader>
              <TableHeader>Discount</TableHeader>
              <TableHeader>Color</TableHeader>
              <TableHeader>Line Notes</TableHeader>
              <TableHeader>Line Total</TableHeader>
              <TableHeader> </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((l) => (
              <TableRow key={l.key}>
                <TableCell>
                  <SearchInput
                    name={`part-${l.key}`}
                    label=""
                    placeholder="Search products"
                    value={l.partNumber}
                    onInput={(v: string) => {
                      updateLine(l.key, { partNumber: v });
                      setActiveLine(l.key);
                    }}
                    onChange={(v: string) => updateLine(l.key, { partNumber: v })}
                  />
                </TableCell>
                <TableCell>
                  <Input name={`desc-${l.key}`} label="" value={l.description} onChange={(v: string) => updateLine(l.key, { description: v })} />
                </TableCell>
                <TableCell>
                  <NumberInput name={`qty-${l.key}`} label="" min={0} value={l.qty} onChange={(v: number) => updateLine(l.key, { qty: v })} />
                </TableCell>
                <TableCell>
                  <CurrencyInput name={`price-${l.key}`} label="" currency="USD" min={0} value={l.price} onChange={(v: number) => updateLine(l.key, { price: v })} />
                </TableCell>
                <TableCell>
                  <CurrencyInput name={`cost-${l.key}`} label="" currency="USD" min={0} value={l.cost} onChange={(v: number) => updateLine(l.key, { cost: v })} />
                </TableCell>
                <TableCell>
                  <CurrencyInput
                    name={`discount-${l.key}`}
                    label=""
                    currency="USD"
                    min={0}
                    value={l.discount}
                    onChange={(v: number) => updateLine(l.key, { discount: v })}
                  />
                </TableCell>
                <TableCell>
                  <Input name={`color-${l.key}`} label="" value={l.color} onChange={(v: string) => updateLine(l.key, { color: v })} />
                </TableCell>
                <TableCell>
                  <Input name={`notes-${l.key}`} label="" value={l.notes} onChange={(v: string) => updateLine(l.key, { notes: v })} />
                </TableCell>
                <TableCell>{money(lineTotal(l))}</TableCell>
                <TableCell>
                  <Button size="xs" variant="secondary" onClick={() => removeLine(l.key)}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Product matches for the line being typed in */}
        {activeLine !== null && activePart.trim().length >= 2 && (
          <Flex direction="column" gap="xs">
            <Text format={{ fontWeight: 'demibold' }}>
              Product matches for line {lines.findIndex((l) => l.key === activeLine) + 1}
            </Text>
            {productSearch.loading && <LoadingSpinner size="xs" label="Searching products" />}
            {productSearch.error && <Text variant="microcopy">Search failed: {productSearch.error}</Text>}
            {!productSearch.loading && !productSearch.error && productSearch.results.length === 0 && (
              <Text variant="microcopy">No matching products. You can keep the part number as typed.</Text>
            )}
            {productSearch.results.length > 0 && (
              <Table bordered={true}>
                <TableHead>
                  <TableRow>
                    <TableHeader>SKU</TableHeader>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Price</TableHeader>
                    <TableHeader>Cost</TableHeader>
                    <TableHeader> </TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productSearch.results.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.sku || '—'}</TableCell>
                      <TableCell>{p.name || '—'}</TableCell>
                      <TableCell>{p.price ? money(Number(p.price)) : '—'}</TableCell>
                      <TableCell>{p.cost ? money(Number(p.cost)) : '—'}</TableCell>
                      <TableCell>
                        <Button size="xs" onClick={() => pickProduct(p)}>
                          Use
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Box>
              <Button size="xs" variant="secondary" onClick={() => setActiveLine(null)}>
                Close matches
              </Button>
            </Box>
          </Flex>
        )}

        <Box>
          <Button variant="secondary" onClick={() => setLines((prev) => [...prev, blankLine()])}>
            Add line
          </Button>
        </Box>

        <Statistics>
          <StatisticsItem label="Order Total" number={money(orderTotal)} />
          <StatisticsItem label="Total Cost" number={money(totalCost)} />
          <StatisticsItem label="Margin" number={money(marginAmt)} />
          <StatisticsItem label="Margin %" number={`${marginPct.toFixed(1)}%`} />
        </Statistics>

        <Divider />

        <TextArea
          name="instructions"
          label="Special Instructions"
          rows={4}
          value={instructions}
          onChange={(v: string) => setInstructions(v)}
        />

        <Flex direction="row" gap="sm">
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit order request'}
          </Button>
        </Flex>

        <Divider />
        <Text variant="microcopy">{FORM_FOOTER}</Text>
      </Flex>
    </>
  );
};
