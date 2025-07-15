import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { type User, type UpdateUserInput, type LoyaltyCredit } from '@schema';
import { useAppStore } from '@/store/main';

// ------------ Zustand Helpers ------------
const apiBase = () => useAppStore.getState().api_client;

// ------------ Fetchers -------------------
const getCurrentUser = async (): Promise<User> =>
  (await apiBase().get<User>('/users/me')).data;

const updateCurrentUser = async (payload: UpdateUserInput): Promise<User> =>
  (await apiBase().patch<User>('/users/' + payload.id, payload)).data;

const getCredits = async (): Promise<LoyaltyCredit[]> =>
  (await apiBase().get<LoyaltyCredit[]>('/guest/credits')).data;

const redeemCredit = async ({ creditId, redeemed = true }: { creditId: string; redeemed: boolean }) =>
  (await apiBase().patch(`/credits/${creditId}`, { redeemed })).data;

const getSavedCards = async () => {
  interface StripeCard { id: string; card: { brand: string; last4: string; exp_month: number; exp_year: number }; }
  const res = await apiBase().get<StripeCard[]>('/stripe/saved-cards');
  return res.data;
};

const deleteCard = async (pmId: string) =>
  (await apiBase().delete(`/stripe/payment-methods/${pmId}`)).data;

const addCard = async (token: string) =>
  (await apiBase().post('/stripe/payment-methods', { token })).data;

const changePassword = async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
  (await apiBase().post('/users/change-password', { currentPassword, newPassword })).data;

const toggle2FA = async (enable: boolean, totpCode?: string) =>
  (await apiBase().post('/users/enable-2fa', { enable, totpCode })).data;

const uploadFile = async (file: File) => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiBase().post<{ url: string }>('/file_uploads', form);
  return data.url;
};

// ------------ View Component -----------------
const UV_GuestProfile: React.FC = () => {
  const authUser = useAppStore((st) => st.auth_user)!;
  const queryClient = useQueryClient();
  const screenSize = useAppStore((st) => st.screen_size);
  const pushNotification = useAppStore((st) => st.push_notification);

  // state for modal toggles
  const [showAvatar, setShowAvatar] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [oldPwd, setOldPw] = useState('');
  const [newPwd, setNewPw] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [faModalOpen, setFaModalOpen] = useState(false);
  const cardModalOpen = useState(false)[0];

  // ---- Queries ----
  const { data: user } = useQuery(['me'], getCurrentUser, { initialData: authUser, staleTime: Infinity });
  const { data: credits = [] } = useQuery(['loyaltyCredits'], getCredits, { retry: false });
  const { data: cards = [] } = useQuery(['savedCards'], getSavedCards, { retry: false });

  // ---- Mutations ----
  const { mutate: updateUser } = useMutation(updateCurrentUser, {
    onSuccess: (data) => {
      queryClient.setQueriesData(['me'], data);
      pushNotification({ type: 'success', title: 'Saved', body: 'Profile updated' });
    },
    onError: () => pushNotification({ type: 'error', title: 'Error', body: 'Could not update profile' }),
  });

  const { mutate: doUpload } = useMutation(uploadFile, {
    onSuccess: (url) => {
      if (user) updateUser({ id: user.id, avatar_url: url });
    },
  });

  const { mutate: doRedeem } = useMutation(redeemCredit, {
    onSettled: () => queryClient.invalidateQueries(['loyaltyCredits']),
  });

  const { mutate: doDeleteCard } = useMutation(deleteCard, {
    onSettled: () => queryClient.invalidateQueries(['savedCards']),
  });

  const { mutate: doAddCard } = useMutation(addCard, {
    onSettled: () => queryClient.invalidateQueries(['savedCards']),
    onError: () => pushNotification({ type: 'error', title: 'Card', body: 'Card add failed' }),
  });

  const { mutate: doChangePassword } = useMutation(changePassword, {
    onSuccess: () => pushNotification({ type: 'success', title: 'Success', body: 'Password updated' }),
  });

  const { mutate: doToggle2FA } = useMutation(toggle2FA, {
    onSuccess: (data: any) => pushNotification({ type: 'success', title: data.message || 'Done', body: '' }),
  });

  // --------------- RENDER (one block) ---------------
  return (
    <>
      <div className={`w-full min-h-screen bg-gray-50 ${(screenSize === 'lg' || screenSize === 'xl') ? 'flex' : 'flex-col'}`}>
        <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
          <h1 className="text-2xl md:text-3xl font-bold mb-6">Account & Wallet</h1>

          {/* Personal Info */}
          <div className="bg-white rounded-xl shadow mb-6 p-6">
            <h2 className="font-semibold text-xl mb-4">Personal Information</h2>
            <div className="flex items-center gap-4  mb-4">
              <img
                src={user?.avatar_url || `https://picsum.photos/120/120?seed=${user?.id}`}
                alt="avatar"
                className="w-24 h-24 rounded-full object-cover"
              />
              <label className="cursor-pointer text-sm text-blue-600 hover:underline">
                Edit avatar
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) doUpload(file);
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm font-medium">
                First name
                <input
                  type="text"
                  defaultValue={user?.first_name}
                  placeholder="e.g. Ana"
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                  onBlur={(e) => user?.id && updateUser({ id: user.id, first_name: e.target.value })}
                />
              </label>
              <label className="text-sm font-medium">
                Last name
                <input
                  type="text"
                  defaultValue={user?.last_name}
                  placeholder="e.g. Doe"
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                  onBlur={(e) => user?.id && updateUser({ id: user.id, last_name: e.target.value })}
                />
              </label>
              <label className="text-sm font-medium">
                Email
                <input
                  type="email"
                  value={user?.email}
                  disabled
                  className="mt-1 block w-full rounded border border-gray-300 bg-gray-100 px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium">
                Phone (E164)
                <input
                  type="tel"
                  defaultValue={user?.phone_e164 || ''}
                  placeholder="+1234567890"
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                  onBlur={(e) => user?.id && updateUser({ id: user.id, phone_e164: e.target.value || null })}
                />
              </label>
            </div>
          </div>

          {/* Loyalty Wallet */}
          <div className="bg-white rounded-xl shadow mb-6 p-6">
            <h2 className="font-semibold text-xl mb-4">Loyalty Wallet</h2>
            {credits.length === 0 ? (
              <p className="text-gray-600">No credits available</p>
            ) : (
              <ul className="space-y-3">
                {credits.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between items-center border rounded p-3"
                  >
                    <div>
                      <p className="font-bold">${c.amount_usd} USD</p>
                      <p className="text-xs text-gray-500">Expires {c.expires_at}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={c.redeemed_at != null}
                      onChange={() => doRedeem({ creditId: c.id, redeemed: !c.redeemed_at })}
                      className="scale-110"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-xl shadow mb-6 p-6">
            <h2 className="font-semibold text-xl mb-4">Payment Methods</h2>
            {cards.map((c: any) => (
              <div key={c.id} className="flex justify-between items-center mb-2">
                <span>
                  {c.card?.brand} •••{c.card?.last4} (expires {c.card?.exp_month.toString().padStart(2, '0')}/{c.card?.exp_year})
                </span>
                <button
                  className="text-red-500 text-sm"
                  onClick={() => doDeleteCard(c.id)}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="mt-3 text-sm bg-blue-600 text-white px-3 py-1 rounded"
              onClick={() => {
                window.Stripe((window as any).Stripe)?.elements().create('card').mount('#add-card-form');
              }}
            >
              Add new card
            </button>
            <div id="add-card-form" className="mt-3 h-12" />
          </div>

          {/* Security */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold text-xl mb-4">Security</h2>
            <div className="flex gap-3 mb-3">
              <button
                className="px-3 py-2 rounded bg-blue-600 text-white text-sm"
                onClick={() => setPwModalOpen(true)}
              >
                Change password
              </button>
              <button
                className="px-3 py-2 rounded bg-blue-600 text-white text-sm"
                onClick={() => setFaModalOpen(true)}
              >
                {/* placeholder 2FA toggle */}
                Toggle 2FA
              </button>
            </div>
          </div>

          {/* Change Password Modal */}
          {pwModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex-center">
              <div className="bg-white p-6 rounded min-w-80">
                <h3 className="font-semibold mb-2">Change password</h3>
                <label className="block mb-2">
                  Current password
                  <input type="password" value={oldPwd} onChange={(e) => setOldPw(e.target.value)} className="block w-full border px-2 py-1" />
                </label>
                <label className="block mb-2">
                  New password
                  <input type="password" value={newPwd} onChange={(e) => setNewPw(e.target.value)} className="block w-full border px-2 py-1" />
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setPwModalOpen(false)} className="text-sm">Cancel</button>
                  <button
                    onClick={() => {
                      doChangePassword({ currentPassword: oldPwd, newPassword: newPwd });
                      setPwModalOpen(false);
                    }}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2FA Modal (placeholder workflow) */}
          {faModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex-center">
              <div className="bg-white p-6 rounded min-w-80">
                <h3 className="font-semibold mb-2">2FA Setup</h3>
                <input
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="block w-full border px-2 py-1 mb-2"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setFaModalOpen(false)} className="text-sm">Cancel</button>
                  <button
                    onClick={() => {
                      doToggle2FA(true, otpCode);
                      setFaModalOpen(false);
                    }}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Enable
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="bg-gray-100 text-center py-6 text-sm text-gray-500">
        GV_Footer stub –Conditions & policies
      </footer>
    </>
  );
};

export default UV_GuestProfile;