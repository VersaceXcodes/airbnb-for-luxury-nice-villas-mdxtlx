import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { loadStripe, StripeCardElement } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import type { Booking, Villa } from '@schema';

// -- helpers
const LS_KEY = 'checkout_draft';
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_injected';
const stripePromise = loadStripe(STRIPE_PK);

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface CheckoutDraft {
  villa_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  infants: number;
  concierge_services: string[];
  price_breakdown: any;
  payment_plan: 'full' | '50_50';
  guest: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    passport?: string;
  };
  contract_signed: boolean;
}
interface StepValidations {
  1?: string;
  2?: string;
  3?: string;
}

type Step = 1 | 2 | 3;

const parseFromQS = (key: string, def = ''): string =>
  new URLSearchParams(location.search).get(key) || def;

const CheckoutForm: React.FC = () => {
  const { villaSlug, villaId } = useParams<{ villaSlug: string; villaId: string }>();
  const stepParam = parseFromQS('step') as Step;
  const navigate = useNavigate();

  // global
  const authUser = useAppStore((s) => s.auth_user);
  const stripeLoaded = useAppStore((s) => s.stripe_script_loaded);
  const pushNotification = useAppStore((s) => s.push_notification);
  const apiClient = useAppStore((s) => s.api_client);

  // local
  const [currentStep, setCurrentStep] = useState<Step>(stepParam || 1);
  const [draft, setDraft] = useState<CheckoutDraft>(() => {
    const stored = localStorage.getItem(LS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return {
      villa_id: villaId!,
      check_in: '',
      check_out: '',
      adults: 2,
      children: 0,
      infants: 0,
      concierge_services: [],
      price_breakdown: {},
      payment_plan: 'full',
      guest: {},
      contract_signed: false,
      ...parsed,
    };
  });
  const [holdExpiresAt, setHoldExpiresAt] = useState<number>(0);
  const [validationErrors, setValidationErrors] = useState<StepValidations>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);

  // refs
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // -- query client
  const qc = useQueryClient();

  // -- fetches
  const { data: villa, isLoading: loadingVilla } = useQuery<Villa>({
    queryKey: ['villa', villaId],
    queryFn: () =>
      apiClient.get(`/villas/${villaId}`).then((r) => r.data),
    enabled: !!villaId,
  });

  // -- mutations
  const holdMutation = useMutation({
    mutationFn: (body: {
      check_in: string;
      check_out: string;
      adults: number;
      children: number;
      infants: number;
      addons?: string[];
    }) =>
      apiClient.post<{ booking_id: string; expires_at: number }>(
        '/bookings/hold',
        { ...body, villa_id: villaId },
      ),
    onSuccess: (d) => setHoldExpiresAt(d.data.expires_at),
  });

  const confirmMutation = useMutation({
    mutationFn:async (body: { booking_id: string }) =>
      apiClient.put(`/bookings/${body.booking_id}/confirm`, { status: 'confirmed' }),
    onSuccess: () => {
      pushNotification({ type: 'success', title: 'Booking Locked!' });
      localStorage.removeItem(LS_KEY);
      navigate('/confirmation');
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('purpose', 'verification');
      return apiClient.post<File>('/file_uploads', form).then(r => r.data);
    },
    onMutate: () => setIsUploading(true),
    onSettled: () => setIsUploading(false),
    onSuccess: (file) => setUploadedDocs((p) => [...p, file.file_url]),
  });

  // -- effects
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(LS_KEY, JSON.stringify(draft));
    }, 500);
  }, [draft]);

  useEffect(() => {
    if (!holdExpiresAt || currentStep < 3) return;
    const iv = setInterval(() => {
      if (Date.now() / 1000 > holdExpiresAt) {
        pushNotification({ type: 'error', title: 'Hold expired!' });
        navigate('/', { replace: true });
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [holdExpiresAt]);

  // -- helpers
  const gotoStep = (s: Step) => {
    setCurrentStep(s);
    navigate({ search: `?step=${s}` });
  };

  const validate = (s: Step): boolean => {
    const errs: StepValidations = {};
    switch (s) {
      case 1:
        if (!draft.check_in || !draft.check_out) errs[1] = 'Select dates';
        break;
      case 2:
        if (!draft.guest.first_name) errs[2] = 'Enter first name';
        if (!draft.guest.last_name) errs[2] = 'Enter last name';
        if (!draft.guest.email) errs[2] = 'Enter email';
        if (!draft.guest.phone) errs[2] = 'Enter phone';
        break;
      case 3:
        if (!draft.contract_signed) errs[3] = 'Sign contract';
        break;
      default:
    }
    setValidationErrors(errs);
    return !errs[s];
  };

  const onNext = async () => {
    if (!validate(currentStep)) return;
    const next = (currentStep + 1) as Step;
    if (next === 2) {
      await holdMutation.mutateAsync({
        check_in: draft.check_in,
        check_out: draft.check_out,
        adults: draft.adults,
        children: draft.children,
        infants: draft.infants,
        addons: draft.concierge_services,
      });
    } else if (next === 4) {
      // submit => handled in final button
    }
    gotoStep(next);
  };

  // -- render single block
  return (
    <>
      {/* Focused overlay */}
      <div className="fixed inset-0 bg-black/60 z-10" />
      <div className="relative z-20 min-h-screen bg-white max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* Main content */}
        <main className="p-6 lg:p-10 flex flex-col min-h-screen">
          {/* Header stepper */}
          <header className="h-16 flex items-center border-b mb-6 shrink-0">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`flex-1 h-full flex items-center justify-center font-bold ${currentStep >= n ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                {n === 1 ? 'Trip Details' : n === 2 ? 'Guest & Payment' : 'Review & Sign'}
                {n < 3 && <span className="ml-2 text-sm">({n})</span>}
              </div>
            ))}
          </header>

          {/* Stepper body */}
          <div className="flex-grow">
            {currentStep === 1 && (
              <section>
                <h2 className="text-2xl font-bold mb-4">{villa?.title}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="font-semibold block mb-1">Check-in</label>
                    <input type="date" className="border rounded px-2 py-1 w-full" value={draft.check_in} onChange={(e) => setDraft((d) => ({ ...d, check_in: e.target.value }))} />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Check-out</label>
                    <input type="date" className="border rounded px-2 py-1 w-full" value={draft.check_out} onChange={(e) => setDraft((d) => ({ ...d, check_out: e.target.value }))} />
                  </div>
                  {/* guest counters */}
                  {(['adults', 'children', 'infants'] as const).map((k) => (
                    <div key={k}>
                      <label className="font-semibold block mb-1">{k.charAt(0).toUpperCase() + k.slice(1)}</label>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => setDraft((d) => ({ ...d, [k]: Math.max(0, (d as any)[k] - 1) }))} className="w-8 rounded bg-gray-200">-</button>
                        <span>{(draft as any)[k]}</span>
                        <button onClick={() => setDraft((d) => ({ ...d, [k]: (d as any)[k] + 1 }))} className="w-8 rounded bg-gray-200">+</button>
                      </div>
                    </div>
                  ))}
                  {/* add-ons */}
                  <div>
                    <h3 className="font-semibold mb-2">Concierge Extras</h3>
                    {['chef', 'yacht', 'spa'].map((tag) => (
                      <label key={tag} className="flex items-center mb-1">
                        <input type="checkbox" className="mr-2" checked={draft.concierge_services.includes(tag)} onChange={(e) => setDraft((d) => ({ ...d, concierge_services: e.target.checked ? [...d.concierge_services, tag] : d.concierge_services.filter((t) => t !== tag) }))} />
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
              </section>
            )}
            {currentStep === 2 && (
              <section>
                <h2 className="text-2xl font-bold mb-4">Guest & Payment</h2>
                <div className="space-y-4">
                  {[['first_name', 'First'], ['last_name', 'Last']] as const).map(([k, label]) => (
                    <div key={k}>
                      <label className="font-semibold block mb-1">{label}</label>
                      <input type="text" className="border rounded px-2 py-1 w-full" value={draft.guest[k] || ''} onChange={(e) => setDraft((d) => ({ ...d, guest: { ...d.guest, [k]: e.target.value } }))} />
                    </div>
                  ))}
                  <div>
                    <label className="font-semibold block mb-1">Email</label>
                    <input type="email" className="border rounded px-2 py-1 w-full" value={draft.guest.email || ''} onChange={(e) => setDraft((d) => ({ ...d, guest: { ...d.guest, email: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Phone</label>
                    <input type="tel" placeholder="+1 555 123 4567" className="border rounded px-2 py-1 w-full" value={draft.guest.phone || ''} onChange={(e) => setDraft((d) => ({ ...d, guest: { ...d.guest, phone: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Passport (if required)</label>
                    <input type="text" className="border rounded px-2 py-1 w-full" value={draft.guest.passport || ''} onChange={(e) => setDraft((d) => ({ ...d, guest: { ...d.guest, passport: e.target.value } }))} />
                  </div>
                  {/* docs */}
                  <div>
                    <label className="font-semibold block mb-1">ID Documents</label>
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" multiple onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) await uploadDocMutation.mutateAsync(file);
                    }} />
                    {isUploading && <span>Uploading...</span>}
                    {uploadedDocs.map((url, i) => (
                      <img key={i} src={url} className="w-20 h-20 object-cover rounded" alt={`doc-${i}`} />
                    ))}
                  </div>
                  {/* stripe */}
                  {stripeLoaded && (
                    <div>
                      <h3 className="font-semibold mb-2">Card Details</h3>
                      {uploadDocMutation.isError && <p className="text-red-500 text-sm">{uploadDocMutation.error instanceof Error ? uploadDocMutation.error.message : 'Upload failed'}</p>}
                      <CardElement options={{ hidePostalCode: true, style: { base: { fontSize: '16px' } } }} />
                    </div>
                  )}
                  {/* payment plan */}
                  <div>
                    <label className="inline-flex items-center">
                      <input type="radio" name="pp" value="full" checked={draft.payment_plan === 'full'} onChange={() => setDraft((d) => ({ ...d, payment_plan: 'full' }))} className="mr-2" />
                      Pay full now
                    </label>
                    <label className="inline-flex items-center ml-4">
                      <input type="radio" name="pp" value="50_50" checked={draft.payment_plan === '50_50'} onChange={() => setDraft((d) => ({ ...d, payment_plan: '50_50' }))} className="mr-2" />
                      50 % now + 50 % later
                    </label>
                  </div>
                </div>
              </section>
            )}
            {currentStep === 3 && (
              <section className="space-y-4">
                <h2 className="text-2xl font-bold mb-4">Review & Sign</h2>
                {/* iframe contract */}
                <div className="border rounded overflow-hidden">
                  <iframe src="https://demo.pandadoc.com/contract" className="w-full h-96" onLoad={(e) => setDraft((d) => ({ ...d, contract_signed: true }))}></iframe>
                </div>
                <p className="text-sm text-gray-600">Please scroll and sign above.</p>
                {/* final totals */}
                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-2">Final Charges</h3>
                  <div className="space-y-1 text-sm">
                    <div><span>Nightly:</span> <span>${(villa?.base_price_usd_per_night || 0).toFixed(2)}</span></div>
                    <div><span>Cleaning:</span> <span>${(villa?.cleaning_fee_usd || 0).toFixed(2)}</span></div>
                    <div><span>Service fee:</span> <span>${((villa?.service_fee_ratio || 0) * 100).toFixed(1)}%</span></div>
                    <div><span>Damage waiver:</span> <span>${((villa?.damage_waiver_ratio || 0) * 100).toFixed(1)}%</span></div>
                    <div className="font-bold"><span>Total now:</span> <span>${(draft.payment_plan === 'full' ? '100%' : '50%')}</span></div>
                  </div>
                </div>
                {holdExpiresAt && (
                  <div className="text-center">
                    <span className="text-sm">Timer: {Math.round(holdExpiresAt - Date.now() / 1000)}s</span>
                  </div>
                )}
              </section>
            )}
            {Object.values(validationErrors).find(Boolean) && (
              <p className="text-red-600 text-sm mt-2">{Object.values(validationErrors).find(Boolean)}</p>
            )}
          </div>

          {/* Navigation buttons */}
          <footer className="mt-auto pt-6 border-t">
            <div className="flex justify-between items-center">
              {currentStep > 1 ? (
                <button onClick={() => gotoStep((currentStep - 1) as Step)} className="text-sm underline">Back</button>
              ) : <div />}
              {currentStep < 3 ? (
                <button onClick={onNext} disabled={holdMutation.isPending || loadingVilla} className="bg-[#C3A27E] text-white rounded px-4 py-2">
                  Next
                </button>
              ) : null}
            </div>
            {currentStep === 3 && (
              <button
                disabled={!draft.contract_signed || confirmMutation.isPending}
                onClick={async () => {
                  // placeholder – gather final payload and confirm
                  // assume booking id from hold
                  const booking_id = holdMutation.data?.data.booking_id;
                  if (!booking_id) return;
                  await confirmMutation.mutateAsync({ booking_id });
                }}
                className={`${draft.contract_signed ? 'bg-[#C3A27E]' : 'bg-gray-400'} w-full text-white rounded px-4 py-2 mt-2 ${!draft.contract_signed && 'cursor-not-allowed'}`}
              >
                Pay & Secure Villa
              </button>
            )}
          </footer>
        </main>

        {/* Sidebar totals */}
        <aside className="hidden lg:block bg-gray-50 p-6 space-y-4 sticky top-0 h-screen">
          <h3 className="text-lg font-bold">Total</h3>
          <div className="text-2xl font-bold">
            ${((villa?.base_price_usd_per_night || 0) * 7 + (villa?.cleaning_fee_usd || 0)).toFixed(2)}
          </div>
          <button className="w-full bg-gray-200 text-sm rounded px-2 py-1 mt-4" onClick={() => console.log('Add villa event')}>
            Add another villa
          </button>
          <p className="text-xs text-gray-500 text-center">Prices in USD, final on checkout.</p>
        </aside>
      </div>
    </>
  );
};

const UV_WizardCheckout: React.FC = () => (
  <Elements stripe={stripePromise}>
    <CheckoutForm />
  </Elements>
);

export default UV_WizardCheckout;