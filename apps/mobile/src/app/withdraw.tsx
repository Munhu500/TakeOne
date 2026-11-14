import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CURRENCIES, formatMoney, sumBalances, validateWithdrawal, WITHDRAWAL_METHODS, withdrawalMethodsFor, withdrawalSchema, type CurrencyCode, type WithdrawalMethod } from '@takeone/shared';
import { Button, Card, Chip, Field, Row, Screen, Text, toast, toastError } from '@/components/ui';
import { useMe, useUid } from '@/lib/data';
import { rpc } from '@/lib/supabase';
import { useLedger } from './(tabs)/wallet';

const LABELS: Record<string, string> = { upi_id: 'UPI ID', account_name: 'Account holder name', account_number: 'Account number', ifsc: 'IFSC code', iban: 'IBAN', email: 'Account email' };

export default function Withdraw() {
  const uid = useUid();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data } = useLedger();
  const currency = (me?.profile.currency ?? 'USD') as CurrencyCode;
  const available = useMemo(() => sumBalances(data?.entries ?? []).available, [data]);
  const methods = withdrawalMethodsFor(me?.profile.country ?? 'US');
  const [method, setMethod] = useState<WithdrawalMethod>(methods[0]!);
  const [dest, setDest] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const decimals = CURRENCIES[currency].decimals;
  // typed major units → integer minor units, once, at the edge
  const minor = Math.round(Number(amount || 0) * 10 ** decimals);
  const amountError = amount ? validateWithdrawal(minor, available) : null;

  async function submit() {
    const parsed = withdrawalSchema.safeParse({ method, amount_minor: minor, destination: dest });
    if (!parsed.success) return toast('Fill in every payout detail', 'bad');
    if (me?.creator?.kyc_status !== 'verified') return router.push('/kyc');
    setBusy(true);
    try {
      await rpc('request_withdrawal', { p_method: method, p_destination: dest, p_amount_minor: minor });
      await qc.invalidateQueries({ queryKey: ['ledger', uid] });
      toast(`${formatMoney(minor, currency)} is on its way.`);
      router.back();
    } catch (e) {
      if (e instanceof Error && e.message === 'KYC_REQUIRED') router.push('/kyc'); else toastError(e);
    } finally { setBusy(false); }
  }
  return (
    <Screen edges={false} footer={<Button title={me?.creator?.kyc_status === 'verified' ? `Withdraw ${minor > 0 ? formatMoney(minor, currency) : ''}` : 'Continue to ID check'} disabled={!minor || !!amountError} loading={busy} onPress={submit} />}>
      <Card style={{ gap: 4 }}><Text size="sm" tone="muted">Available</Text><Text size="xl" weight="bold">{formatMoney(available, currency)}</Text><Text size="xs" tone="faint">Only available balance can be withdrawn. Pending and cleared amounts unlock automatically.</Text></Card>
      <Field label={`Amount (${currency})`} value={amount} onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" error={amountError} />
      <Button small variant="ghost" title="Withdraw everything" onPress={() => setAmount((available / 10 ** decimals).toFixed(decimals))} />
      <View style={{ gap: 8 }}>
        <Text size="sm" tone="muted" weight="medium">Payout method</Text>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>{methods.map((m) => <Chip key={m} label={WITHDRAWAL_METHODS[m].label} on={method === m} onPress={() => { setMethod(m); setDest({}); }} />)}</Row>
      </View>
      {WITHDRAWAL_METHODS[method].fields.map((f) => <Field key={f} label={LABELS[f] ?? f} value={dest[f] ?? ''} onChangeText={(t) => setDest({ ...dest, [f]: t })} autoCapitalize={f === 'ifsc' || f === 'iban' ? 'characters' : 'none'} keyboardType={f === 'email' ? 'email-address' : 'default'} />)}
      <Text size="xs" tone="faint">Demo mode: payouts are simulated and marked paid instantly.</Text>
    </Screen>
  );
}
