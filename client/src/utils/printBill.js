import api from './api';

export async function printBill(billOrId) {
  const billId = typeof billOrId === 'object' ? billOrId?.id : billOrId;
  if (!billId) throw new Error('Bill id is required for printing');

  const response = await api.post(`/billing/${billId}/print`);
  return response.data;
}
