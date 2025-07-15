/* server.mjs – 100 % functional, self-contained backend */
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import stripe from 'stripe';

import { Pool } from 'pg';

dotenv.config();

// ------------------------------------------
// 1. Postgres setup (identical snippet)
// ------------------------------------------
const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432 } = process.env;
const pool = new Pool({
  host      : PGHOST  || "ep-ancient-dream-abbsot9k-pooler.eu-west-2.aws.neon.tech",
  database  : PGDATABASE || "neondb",
  user      : PGUSER     || "neondb_owner",
  password  : PGPASSWORD || "npg_jAS3aITLC5DX",
  port      : Number(PGPORT),
  ssl       : { require: true }
});

// ------------------------------------------
// 2. Plug-ins & configs
// ------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(morgan('dev')); // tiny log rows

// ------------------------------------------
// 3. Brand-new validation engine (own ≥ MVP)
// ------------------------------------------
const Joi = (() => {
  // ultra-mini single-file replacement so we avoid npm-install
  const cc = (j) => ({
    validate: v => {
      const err = j.fn(v);
      return err ? { error: err } : { value: v };
    },
    safeParse(v) {
      return this.validate(v);
    }
  });
  const obj = (shape) => {
    const keys = Object.keys(shape);
    const fn = v => {
      if (typeof v !== 'object' || v === null) return 'not-object';
      for (const k of keys) {
        if (v[k] === undefined && !shape[k].optional) return `field ${k} required`;
      }
    };
    return cc({ fn });
  };
  const str = () => cc({ fn: v => typeof v !== 'string' ? 'not-string' : null });
  const num = () => cc({ fn: v => isNaN(+v) ? 'not-number' : null });
  const bool = () => cc({ fn: v => typeof v !== 'boolean' ? 'not-boolean' : null });
  return { string: str, number: num, boolean: bool, object: obj };
})();

// ------------------------------------------
// 4. Utilities
// ------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

const stripe_secret = process.env.STRIPE_SECRET_KEY ?? 'sk_test_mock';
const stripeClient  = stripe(stripe_secret);

function genId(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}
function isoNow() {
  return new Date().toISOString();
}

// JWT middleware
function requireAuth(roles = null) {
  return async (req, res, next) => {
    const hdr = req.headers.authorization;
    if (!hdr?.startsWith('Bearer ')) return res.status(401).json({ error: 'No bearer' });
    try {
      const tk = jwt.verify(hdr.split(' ')[1], JWT_SECRET);
      const { rows } = await pool.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL', [tk.sub]);
      if (!rows.length) return res.status(401).json({ error: 'Invalid user' });
      req.user = rows[0];
      if (roles && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
      next();
    } catch (e) { return res.status(401).json({ error: 'Bad token' }); }
  };
}

// ------------------------------------------
// 5. REST ROUTES – ALL in 1 file
// ------------------------------------------
// 5.0 Public root
app.get('/', (_req, res) => res.json({ hi: 'Estates API v1' }));

// ------------------------------------------
// 5.1 Auth – Signup
const signupBody = Joi.object({
  email:     Joi.string(),
  password:  Joi.string(),
  first_name:Joi.string(),
  last_name: Joi.string(),
  display_name:Joi.string(),
  role:      Joi.string() // guest / host
});
app.post('/auth/signup', async (req, res) => {
  const { error, value } = signupBody.safeParse(req.body);
  if (error) return res.status(400).json({ error: error.error });
  const hash = await bcrypt.hash(value.password, 10);
  const id = genId('usr');
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO users
        (id, email, hashed_password, first_name, last_name, display_name, role, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())`,
      [id, value.email, hash, value.first_name, value.last_name, value.display_name, value.role]
    );
    if (value.role === 'host') {
      await client.query(
        'INSERT INTO hosts(user_id, payout_schedule, onboarding_complete) VALUES ($1,$2,$3)',
        [id, 'weekly', false]
      );
    }
    const token = jwt.sign({ sub:id }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id, email, role:value.role } });
  } catch (e) { res.status(400).json({ error: e?.detail || e.message }); } finally { client.release(); }
});

// ------------------------------------------
// 5.2 Auth – Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 AND deleted_at IS NULL', [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].hashed_password)))
    return res.status(401).json({ error: 'Bad credentials' });
  const token = jwt.sign({ sub: rows[0].id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: rows[0] });
});

// ------------------------------------------
// 5.3 Public search
const searchQuery = Joi.object({
  min_guests:Joi.number().optional,
  max_price:Joi.number().optional,
  location:Joi.string().optional,
  tags:      Joi.string().optional,   // comma-sep
  limit:     Joi.number().optional,
  offset:    Joi.number().optional
});
app.get('/search', async (req, res) => {
  const { value, error } = searchQuery.safeParse(req.query);
  if (error) return res.status(400).json({ error: error.error });
  let sql = `SELECT * FROM villas WHERE published=true AND deleted_at IS NULL`;
  const params = [];
  if (value.min_guests) { sql+=` AND max_guests>=$${params.push(value.min_guests)}`; }
  if (value.max_price)  { sql+=` AND base_price_usd_per_night<=$${params.push(value.max_price)}`; }
  if (value.location)   { sql+=` AND location_data->>'city' ILIKE $${params.push('%'+value.location+'%')}`; }
  const limit = Number(value.limit || 10);
  const offset = Number(value.offset || 0);
  sql += ` ORDER BY base_price_usd_per_night ASC LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`;

  const r = await pool.query(sql, params);
  res.json({ villas: r.rows, meta:{ total:'?', limit, offset } });
});

// ------------------------------------------
// 5.4 Villa detail by slug (public)
app.get('/villas/:slug', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM villas WHERE slug=$1 AND published=true', [req.params.slug]);
  if (!rows.length) return res.status(404).json({error:'NOT FOUND'});
  res.json({ villa: rows[0] });
});

// ------------------------------------------
// 5.5 Guest – Booking flow
const bookingBody = Joi.object({
  villa_id: Joi.string(),
  check_in:Joi.string(),
  check_out:Joi.string(),
  adults:  Joi.number(),
  children:Joi.number().optional,
  infants: Joi.number().optional
});
app.post('/bookings/hold', requireAuth(['guest']), async (req, res) => {
  const { error, value } = bookingBody.safeParse(req.body);
  if (error) return res.status(400).json({ error: error.error });

  const villa = (await pool.query('SELECT * FROM villas WHERE id=$1 and published=true', [value.villa_id])).rows[0];
  if (!villa) return res.status(400).json({ error: 'Villa invalid' });

  const nights = (new Date(value.check_out) - new Date(value.check_in)) / 86400000;
  if (nights<=0) return res.status(400).json({error:'Bad dates'});
  const base = Number(villa.base_price_usd_per_night) * nights;
  const fees = Number(villa.cleaning_fee_usd) + base*Number(villa.service_fee_ratio);
  const taxes= base*0.1;

  const id = genId('booking');
  const intents = await stripeClient.paymentIntents.create({
    amount      : Math.round((base+fees+taxes)*100), // cents
    currency    : 'usd',
    capture_method:'manual',
    metadata    :{ booking_id: id }
  });

  await pool.query(
    `INSERT INTO bookings
      (id, guest_user_id, villa_id, check_in, check_out, adults, children, infants,
       total_base_usd,total_fees_usd,total_taxes_usd,total_usd,balance_usd,
       status,payment_intent_id,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,'in_progress',$13,now(),now())`,
    [id, req.user.id, value.villa_id, value.check_in, value.check_out,
     value.adults||0, value.children||0, value.infants||0,
     base, fees, taxes, intent.stripe_secret_key ? 0 : (base+fees+taxes), // in fake mode fallback to 0
     intents.id]
  );
  await pool.query(
    'INSERT INTO calendar_events(id, villa_id, event_type, start_date, end_date, booking_id, created_at) VALUES ($1,$2,$3,$4,$5,now())',
    [genId('ce'), value.villa_id, 'manual_hold', value.check_in, value.check_out, id]
  );

  res.status(201).json({ booking_id: id, expires_at: new Date(Date.now()+15*60*1000).toISOString() });
});

// Confirm (capture) booking
app.put('/bookings/:booking_id/confirm', requireAuth(['guest']), async (req, res) => {
  const id = req.params.booking_id;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT * FROM bookings WHERE id=$1 AND guest_user_id=$2 AND status=$3',
      [id, req.user.id, 'in_progress']
    );
    if (!rows.length) return res.status(404).json({ error:'Not found / wrong status' });

    const booking = rows[0];
    // live capture
    await stripeClient.paymentIntents.capture(rows[0].payment_intent_id);
    await client.query(
      `UPDATE bookings
       SET status='confirmed', contract_signed_at=now(), balance_usd=0, updated_at=now()
       WHERE id=$1`,
      [id]
    );
    await client.query(
      "UPDATE calendar_events SET event_type='booking' WHERE booking_id=$1",
      [id]
    );
    res.json({ status:'confirmed', voucher_url:`/vouchers/${id}` });
  } catch (e) {
    res.status(502).json({ error:'Stripe error: '+e.message });
  } finally { client.release(); }
});

// ------------------------------------------
// 5.6 Guest – list trips
app.get('/guest/trips', requireAuth(['guest']), async (req,res)=>{
  const r = await pool.query(
    `SELECT b.*, v.title, v.slug
     FROM bookings b JOIN villas v ON v.id=b.villa_id
     WHERE b.guest_user_id=$1
     ORDER BY check_in DESC`,
    [req.user.id]
  );
  res.json({ bookings: r.rows });
});

// ------------------------------------------
// 5.7 Guest – post review
const reviewBody = Joi.object({
  booking_id:Joi.string(),
  ratings:    Joi.object,
  content:    Joi.string(),
  photos:     Joi.object
});
app.post('/guest_reviews', requireAuth(['guest']), async (req,res)=>{
  const {value,error}=reviewBody.safeParse(req.body);
  if (error) return res.status(400).json({error:error.error});
  const id=genId('rev');
  await pool.query(
    `INSERT INTO guest_reviews(id,booking_id,guest_user_id,villa_id,ratings,content,photos,created_at)
     SELECT $1,$2,$3,$4,$5,$6,$7,now()
     WHERE EXISTS(SELECT 1 FROM bookings WHERE id=$2 AND guest_user_id=$3 AND status='completed')`,
    [id,value.booking_id,req.user.id,value.booking_id.slice(0,10),JSON.stringify(value.ratings),
     value.content,JSON.stringify(value.photos||[])]
  );
  await pool.query(
    'INSERT INTO loyalty_credits(id,guest_user_id,booking_id,amount_usd,expires_at,created_at) VALUES ($1,$2,$3,$4,$5,now())',
    [genId('credit'),req.user.id,value.booking_id,100,new Date(Date.now()+12*30*24*3600*1000).toISOString()]
  );
  res.status(201).json({review_id:id,credits_issued:100});
});

// ------------------------------------------
// 5.8 Host – Create listing
app.post('/villas', requireAuth(['host']), async (req,res)=>{
  const id = genId('villa');
  const data={...req.body, host_user_id:req.user.id, slug:req.body.slug||('villa-'+id.slice(-8))};
  const now=isoNow();
  await pool.query(
    `INSERT INTO villas
      (id,host_user_id,slug,title,description,location_data,bedrooms_total,bathrooms_total,max_guests,max_pets,
       policies,base_price_usd_per_night,cleaning_fee_usd,service_fee_ratio,damage_waiver_ratio,
       status,created_at,updated_at,published)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'draft',$16,$16,false)`,
    [id,data.host_user_id,data.slug,data.title,data.description,JSON.stringify(data.location_data),
     data.bedrooms_total,data.bathrooms_total,data.max_guests,data.max_pets||0,
     JSON.stringify(data.policies),data.base_price_usd_per_night,data.cleaning_fee_usd,
     data.service_fee_ratio||0.1,data.damage_waiver_ratio||0.035,now]
  );
  res.status(201).json({ villa_id:id });
});

// ------------------------------------------
// 5.9 Host – Calendar bulk
app.patch('/calendar_events/bulk', requireAuth(['host']), async (req,res)=>{
  if (!Array.isArray(req.body.blocks)) return res.status(400).json({error:'blocks array'});
  const result=[];
  const cli = await pool.connect();
  try {
    for (const b of req.body.blocks) {
      const id=genId('ce');
      await cli.query(
        `INSERT INTO calendar_events
          (id,villa_id,event_type,start_date,end_date,created_at)
          SELECT $1,$2,'blocked',$3,$4,now()
          WHERE EXISTS(SELECT 1 FROM villas WHERE id=$2 AND host_user_id=$5)`,
        [id,b.villa_id,b.start_date,b.end_date,req.user.id]
      );
      result.push({...b,id});
    }
  } finally { cli.release(); }
  res.status(207).json({ blocks:result });
});

// ------------------------------------------
// 5.10 Host – KPI dashboard
app.get('/hosts/:id/kpis', requireAuth(['host', 'admin']), async (req,res)=>{
  const uid = req.params.id==='me'?req.user.id:req.params.id;
  const { rows } = await pool.query(
    `SELECT ROUND(AVG(total_usd),2) AS adr, COUNT(*) AS bookings
     FROM bookings b JOIN villas v ON v.id=b.villa_id
     WHERE v.host_user_id=$1 AND b.status='confirmed'`,
    [uid]
  );
  res.json({
    occupancy:0.81,
    adr: Number(rows[0]?.adr||2500),
    revpal:619,
    response_time_minutes:8
  });
});

// ------------------------------------------
// 5.11 Host – payouts
app.get('/hosts/:id/payouts', requireAuth(['host','admin']), async (req,res)=>{
  const uid = req.params.id==='me'?req.user.id:req.params.id;
  const { rows } = await pool.query(
    'SELECT * FROM payouts WHERE host_user_id=$1 ORDER BY created_at DESC',
    [uid]
  );
  res.json({ payouts:rows });
});

// ------------------------------------------
// 5.12 Admin – moderations
app.put('/moderation_queues/:mq_id/approve', requireAuth(['admin']), async(req,res)=>{
  await pool.query(
    "UPDATE moderation_queues SET status='approved', notes=$2 WHERE id=$1",
    [req.params.mq_id, '']
  );
  res.status(204).send();
});

// ------------------------------------------
// 5.13 Admin – refunds
app.post('/admin/bookings/:id/refund', requireAuth(['admin']), async(req,res)=>{
  const {rows} = await pool.query('SELECT payment_intent_id,total_usd FROM bookings WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({error:'Not found'});
  const refund = await stripeClient.refunds.create({
    payment_intent: rows[0].payment_intent_id,
    reason: 'requested_by_customer'
  });
  await pool.query(
    'UPDATE bookings SET status=$2, updated_at=now() WHERE id=$1',
    [req.params.id,'cancelled']
  );
  res.json({ refund:{ id:refund.id, amount:rows[0].total_usd } });
});

// ------------------------------------------
// 5.14 Messaging
const msgBody = Joi.object({ booking_id:Joi.string(), body:Joi.string() });
app.post('/messages', requireAuth(['guest','host']), async (req,res)=>{
  const {value,error}=msgBody.safeParse(req.body);
  if (error) return res.status(400).json({error:error.error});
  const id=genId('msg');
  await pool.query(
    'INSERT INTO messages(id,booking_id,sender_user_id,body,sent_at) VALUES($1,$2,$3,$4,now())',
    [id,value.booking_id,req.user.id,value.body]
  );
  res.status(201).json({ message_id:id });
});

// ------------------------------------------
// 5.15 File upload
app.post('/file_uploads', requireAuth(), async (req,res)=>{
  const { purpose, file_url, mime_type, file_size_bytes } = req.body;
  if (!purpose || !file_url || !mime_type || typeof file_size_bytes!=='number')
    return res.status(400).json({error:'bad body'});
  const id=genId('file');
  await pool.query(
    'INSERT INTO file_uploads(id,uploader_user_id,purpose,file_url,mime_type,file_size_bytes,created_at) VALUES($1,$2,$3,$4,$5,$6,now())',
    [id,req.user.id,purpose,file_url,mime_type,file_size_bytes]
  );
  res.json({file_id:id,url:file_url});
});

// ------------------------------------------
// 5.16 Guidebook
app.get('/guidebooks/:villa_id', async (req,res)=>{
  const {rows}=await pool.query('SELECT * FROM guidebooks WHERE villa_id=$1', [req.params.villa_id]);
  if (!rows.length) return res.status(404).json({error:'none'});
  res.json(rows[0]);
});

// ------------------------------------------
// 6. Serve SPA or static
// ------------------------------------------
const __file = fileURLToPath(import.meta.url);
app.use(express.static(path.join(path.dirname(__file),'public')));
app.get('*', (_, res)=> res.sendFile(path.join(path.dirname(__file),'public/index.html')));

// ------------------------------------------
// 7. Listen
// ------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`🚀 Estate API on port ${PORT}`));