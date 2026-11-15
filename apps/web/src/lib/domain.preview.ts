// Static preview: there is no server to look the record up from.
export type DomainStatus = 'verified' | 'not_detected' | 'unavailable';
export async function checkDomain(_domain: string, _target: string): Promise<DomainStatus> {
  return 'unavailable';
}
