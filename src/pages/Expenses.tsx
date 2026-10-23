import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Icon,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  Select,
  TableWrap,
  Td,
  TextInput,
  Th,
  useToast,
} from '../components/ui'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { EXPENSE_CATEGORIES } from '../lib/constants'
import { compactInr, date, inr, inputDate, number, titleCase } from '../lib/format'
import type { Expense, Meta } from '../lib/types'

interface ExpenseList {
  expenses: Expense[]
  total: number
  totals: { amount: number }
  page: number
  per_page: number
}

export default function Expenses() {
  const { user } = useAuth()
  const toast = useToast()
  const canWrite = user?.role === 'admin' || user?.role === 'staff'
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const params = new URLSearchParams({ page: String(page), per_page: '20' })
  if (category !== 'all') params.set('category', category)
  if (search.trim()) params.set('q', search.trim())

  const { data, loading, error, reload } = useApi<ExpenseList>(`/expenses?${params.toString()}`)
  const meta = useApi<Meta>('/meta')
  const rows = data?.expenses ?? []

  return (
    <div className="animate-rise">
      <PageHeader
        title="Programme expenses"
        description="Voucher-level expenditure against campaign budgets, with vendor and receipt references."
        actions={
          canWrite ? (
            <Button icon="plus" onClick={() => setOpen(true)}>
              Record expense
            </Button>
          ) : (
            <Badge tone="gold">Read-only access</Badge>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ['Expenditure in view', compactInr(data?.totals.amount ?? 0), 'receipt'],
          ['Vouchers', number(data?.total ?? 0), 'layers'],
          ['Categories used', number(new Set(rows.map((row) => row.category)).size), 'chart'],
        ].map(([label, value, icon]) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-100 text-gold-700">
              <Icon name={icon} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{label}</p>
              <p className="text-lg font-semibold tabular-nums text-ink-900">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-sand-200 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300"
            />
            <TextInput
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search voucher, vendor or description"
              className="pl-10"
            />
          </div>
          <div className="w-full sm:w-52">
            <Select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">All categories</option>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : loading ? (
          <LoadingBlock />
        ) : rows.length ? (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Voucher</Th>
                  <Th>Description</Th>
                  <Th>Campaign</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Date</Th>
                  <Th>Receipt</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((expense) => (
                  <tr key={expense.id} className="transition hover:bg-sand-50/60">
                    <Td>
                      <p className="font-mono text-[11px] text-ink-700">{expense.voucher_no}</p>
                      <p className="text-[10px] text-ink-400">{expense.vendor ?? '—'}</p>
                    </Td>
                    <Td className="max-w-[280px]">
                      <p className="truncate text-[12.5px] text-ink-700">{expense.description}</p>
                    </Td>
                    <Td>
                      <p className="max-w-[190px] truncate text-[12px] text-ink-600">{expense.campaign_title}</p>
                      <p className="font-mono text-[10px] text-ink-400">{expense.campaign_code}</p>
                    </Td>
                    <Td>
                      <Badge tone="slate">{titleCase(expense.category)}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium tabular-nums">
                      {inr(expense.amount)}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-500">{date(expense.spent_at)}</Td>
                    <Td className="font-mono text-[10px] text-ink-400">{expense.receipt_ref ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination page={data?.page ?? 1} perPage={data?.per_page ?? 20} total={data?.total ?? 0} onChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon="receipt"
            title="No expenses recorded"
            description="Log vouchers against a campaign to track how allocated funds are utilised."
            action={canWrite ? <Button icon="plus" onClick={() => setOpen(true)}>Record expense</Button> : undefined}
          />
        )}
      </Card>

      <p className="mt-4 flex items-start gap-2 text-[11px] text-ink-400">
        <Icon name="scale" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Expenditure is capped by the funds allocated for the campaign. Attempting to spend beyond the
        allocated budget is rejected by a database trigger, not just by the form.
      </p>

      {canWrite ? (
        <ExpenseModal
          open={open}
          onClose={() => setOpen(false)}
          campaigns={meta.data?.campaigns ?? []}
          onSaved={(voucher) => {
            setOpen(false)
            toast.push(`Expense recorded · voucher ${voucher}`)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

function ExpenseModal({
  open,
  onClose,
  campaigns,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  campaigns: Meta['campaigns']
  onSaved: (voucher: string) => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    campaign_id: campaigns[0] ? String(campaigns[0].id) : '',
    category: 'procurement',
    description: '',
    amount: '',
    vendor: '',
    receipt_ref: '',
    spent_at: inputDate(),
  })

  const campaign = campaigns.find((item) => String(item.id) === form.campaign_id)
  const available = campaign ? Math.max(0, campaign.allocated - campaign.spent) : 0

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async () => {
    if (!form.description.trim() || !form.amount) {
      toast.push('Description and amount are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const response = await api.post<{ expense: Expense }>('/expenses', {
        campaign_id: Number(form.campaign_id),
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        vendor: form.vendor,
        receipt_ref: form.receipt_ref,
        spent_at: form.spent_at,
      })
      onSaved(response.expense?.voucher_no ?? 'created')
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not record expense.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an expense"
      description="Vouchers are matched against the allocation budget of the campaign."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} icon="receipt">
            Save voucher
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label="Campaign"
          required
          hint={campaign ? `${inr(available)} available to spend` : undefined}
        >
          <Select value={form.campaign_id} onChange={set('campaign_id')}>
            {campaigns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.title}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" required>
            <Select value={form.category} onChange={set('category')}>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount (₹)" required>
            <TextInput type="number" min="1" step="100" value={form.amount} onChange={set('amount')} />
          </Field>
        </div>
        <Field label="Description" required>
          <TextInput
            value={form.description}
            onChange={set('description')}
            placeholder="Procurement of relief supplies"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vendor" hint="optional">
            <TextInput value={form.vendor} onChange={set('vendor')} placeholder="Bharat Supplies Co." />
          </Field>
          <Field label="Receipt reference" hint="invoice / bill no.">
            <TextInput value={form.receipt_ref} onChange={set('receipt_ref')} placeholder="INV-2041" />
          </Field>
        </div>
        <Field label="Expense date" required>
          <TextInput type="date" value={form.spent_at} onChange={set('spent_at')} />
        </Field>
        <p className="rounded-xl bg-gold-100/60 px-3.5 py-2.5 text-[11px] leading-relaxed text-gold-700">
          Spendable budget = allocated funds − recorded expenses. Currently{' '}
          <strong>{inr(available)}</strong> for this campaign.
        </p>
      </div>
    </Modal>
  )
}
