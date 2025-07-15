import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useBeforeUnload } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { use_app_store } from '@/store/main';
import {
  createVillaInputSchema,
  updateVillaInputSchema,
  createRoomTypeInputSchema,
  createAmenityInputSchema,
  createPricingRuleInputSchema,
  createCalendarEventInputSchema,
  createFileUploadInputSchema,
  locationDataSchema,
  villaSchema,
  VillaStatus
} from '@schema';
import { z } from 'zod';

type RoomPayload = z.infer<typeof createRoomTypeInputSchema>;
type AmenityPayload = z.infer<typeof createAmenityInputSchema>;
type PricingRulePayload = z.infer<typeof createPricingRuleInputSchema>;
type CalendarEventPayload = z.infer<typeof createCalendarEventInputSchema>;
type PhotoFile = z.infer<typeof createFileUploadInputSchema> & { id?: string };

const UV_HostListingWizard: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ villaId?: string }>();
  const queryClient = useQueryClient();
  const apiInstance = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000' });

  const authUser = use_app_store((s) => s.auth_user);
  const apiClient = use_app_store((s) => s.api_client);

  const villaId = params.villaId || null;
  const isEdit = !!villaId;

  const [currentStep, setCurrentStep] = useState(1);
  const [dirty, setDirty] = useState(false);

  /* --------------------------------- form state -------------------------------- */
  const [locationData, setLocationData] = useState<z.infer<typeof locationDataSchema>>({ lat: 0, lng: 0, city: '', address: '', postal_code: '', country: '' });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bedroomsTotal, setBedroomsTotal] = useState(0);
  const [bathroomsTotal, setBathroomsTotal] = useState(0);
  const [maxGuests, setMaxGuests] = useState(1);
  const [maxPets, setMaxPets] = useState(0);
  const [basePricePerNight, setBasePricePerNight] = useState(1000);
  const [cleaningFee, setCleaningFee] = useState(300);
  const [serviceFeeRatio, setServiceFeeRatio] = useState(0.1);
  const [damageWaiverRatio, setDamageWaiverRatio] = useState(0.035);

  const [rooms, setRooms] = useState<RoomPayload[]>([]);
  const [amenities, setAmenities] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRulePayload[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventPayload[]>([]);
  const [policies, setPolicies] = useState({ cancellation_tier: 'moderate', security_deposit_usd: 1000, house_rules: [], checkin_time: '15:00', checkout_time: '10:00' });

  /* ------------------------ load existing data when edit ----------------------- */
  const { data: villa, isLoading } = useQuery({
    queryKey: ['villa', villaId],
    queryFn: async () => {
      if (!villaId) return null;
      const { data } = await apiClient.get(`/villas/${villaId}`);
      return villaSchema.parse(data);
    },
    enabled: !!villaId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (villa) {
      setTitle(villa.title);
      setDescription(villa.description);
      setLocationData(villa.location_data);
      setBedroomsTotal(villa.bedrooms_total);
      setBathroomsTotal(villa.bathrooms_total);
      setMaxGuests(villa.max_guests);
      setMaxPets(villa.max_pets);
      setBasePricePerNight(villa.base_price_usd_per_night);
      setCleaningFee(villa.cleaning_fee_usd);
      setServiceFeeRatio(villa.service_fee_ratio);
      setDamageWaiverRatio(villa.damage_waiver_ratio);
      setPolicies(villa.policies);
    }
  }, [villa]);

  /* --------------------------- mutations ------------------------------------- */
  const createVillaMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/villas', payload);
      return data;
    },
    onSuccess: (res) => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['villas'] });
      navigate(`/host/listings/${res.id}/edit?step=${currentStep + 1}`);
    },
  });

  const updateVillaMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.put(`/villas/${villaId}`, payload);
      return data;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['villa', villaId] });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post('/file_uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      return data;
    },
  });

  /* ----------------------------- exit guard ---------------------------------- */
  useEffect(() => {
    const handler = () => dirty && setDirty(dirty);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  useBeforeUnload(({ currentTarget }) => currentTarget = () => null);

  /* --------------------------------- logic ------------------------------------ */
  const formPayload = () => {
    return createVillaInputSchema.parse({
      host_user_id: authUser!.id,
      slug: title.toLowerCase().replace(/\s+/g, '-'),
      title,
      description,
      location_data,
      bedrooms_total: bedroomsTotal,
      bathrooms_total: bathroomsTotal,
      max_guests: maxGuests,
      max_pets: maxPets,
      base_price_usd_per_night: basePricePerNight,
      cleaning_fee_usd: cleaningFee,
      service_fee_ratio: serviceFeeRatio,
      damage_waiver_ratio: damageWaiverRatio,
      status: VillaStatus.enum.draft,
      policies,
    });
  };

  const onNext = async () => {
    const payload = formPayload();
    if (isEdit) {
      await updateVillaMutation.mutateAsync(payload);
    } else {
      await createVillaMutation.mutateAsync(payload);
    }
    if (currentStep < 6) {
      setCurrentStep(s => s + 1);
      setDirty(false);
    } else {
      navigate('/host/dashboard');
    }
  };

  const onBack = () => {
    confirm('Save as draft and leave?') && navigate('/host/listings');
  };

  const ProgressBar = () => (
    <div className="w-full flex justify-center mb-6">
      <ol className="relative text-gray-500 border-l border-gray-200 dark:border-gray-700 dark:text-gray-400">
        {[1, 2, 3, 4, 5, 6].map(n => (
          <li key={n} className={`border-l-[3px] ${currentStep >= n ? 'text-c3a27e border-c3a27e' : 'border-gray-300'} pl-4 py-2`}>
            Step {n}
          </li>
        ))}
      </ol>
    </div>
  );

  if (isLoading) {
    return <div className="p-20 text-center">Loading villa...</div>;
  }

  return (
    <>
      <ProgressBar />
      <div className="max-w-4xl mx-auto px-4">
        {/* ---------- STEP 1 ---------- */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Location</h2>
            <input type="text" placeholder="Search address..." className="w-full border p-2 rounded" onChange={e => {
              setLocationData({ ...locationData, address: e.target.value });
              setDirty(true);
            }} value={locationData.address} />
            <p className="text-sm text-gray-500">Estimated lat/lng: {locationData.lat},{locationData.lng}</p>
          </div>
        )}

        {/* ---------- STEP 2 ---------- */}
        {currentStep === 2 && (
          <div className="flex gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Rooms & Beds</h2>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border rounded p-2 mb-2 cursor-pointer hover:bg-slate-100"
                  onClick={() => {
                    setRooms([...rooms, { villa_id: villaId!, type: 'bedroom', name: `Room ${i + 1}`, beds_json: [] }]);
                    setDirty(true);
                  }}
                >
                  Add Bedroom {i + 1}
                </div>
              ))}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold">Configured Rooms ({rooms.length})</h3>
            </div>
          </div>
        )}

        {/* ---------- STEP 3 ---------- */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-2xl font-bold">Amenities</h2>
            <div className="grid grid-cols-2 gap-3">
              {['pool', 'chef_kitchen', 'gym', 'cinema', 'pet_friendly', 'wifi', 'parking', 'golf'].map(key => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox"
                    checked={amenities[key] || false}
                    onChange={e => {
                      setAmenities({ ...amenities, [key]: e.target.checked });
                      setDirty(true);
                    }}
                  />
                  {key.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ---------- STEP 4 ---------- */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-2xl font-bold">Photos</h2>
            <input type="file" multiple accept="image/*"
              onChange={async e => {
                const files = Array.from(e.target.files || []);
                for (const file of files) {
                  const formData = new FormData();
                  formData.append('file', file);
                  const res = await uploadPhotoMutation.mutateAsync(formData);
                  setPhotos(prev => [...prev, { ...res, uploader_user_id: authUser!.id, purpose: 'villa_photo' }]);
                }
                setDirty(true);
              }}
            />
            <p className="text-sm text-gray-600">{photos.length}/200 uploaded</p>
          </div>
        )}

        {/* ---------- STEP 5 ---------- */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Calendar & Pricing</h2>
            <label>Base Price / Night<input type="number" value={basePricePerNight} className="ml-2 border rounded p-1 w-32" onChange={e => { setBasePricePerNight(+e.target.value); setDirty(true); }} /></label>
            <label>Cleaning Fee<input type="number" value={cleaningFee} className="ml-2 border rounded p-1 w-32" onChange={e => { setCleaningFee(+e.target.value); setDirty(true); }} /></label>
          </div>
        )}

        {/* ---------- STEP 6 ---------- */}
        {currentStep === 6 && (
          <div>
            <h2 className="text-2xl font-bold">Policies</h2>
            <label>Cancellation Tier
              <select value={policies.cancellation_tier} onChange={e => { setPolicies({ ...policies, cancellation_tier: e.target.value }); setDirty(true); }} className="ml-2 border rounded">
                <option value="flexible">Flexible</option>
                <option value="moderate">Moderate</option>
                <option value="strict">Strict</option>
              </select>
            </label>
            <label>Security Deposit USD
              <input type="number" className="ml-2 border rounded p-1 w-32" value={policies.security_deposit_usd} onChange={e => { setPolicies({ ...policies, security_deposit_usd: +e.target.value }); setDirty(true); }} />
            </label>
          </div>
        )}

        {/* ---------- FOOTER ACTIONS ---------- */}
        <div className="mt-8 flex justify-between">
          <button className="btn btn-outline" onClick={onBack}>Back to Listings</button>
          <button className="btn btn-primary" onClick={onNext}>
            {currentStep < 6 ? 'Next' : 'Finish & Publish'}
          </button>
        </div>
      </div>
    </>
  );
};

export default UV_HostListingWizard;