require('dotenv').config();
const express=require('express'),multer=require('multer'),sharp=require('sharp'),crypto=require('crypto');
const app=express(),jobs=new Map(),stripe=process.env.STRIPE_SECRET_KEY?require('stripe')(process.env.STRIPE_SECRET_KEY):null;
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024}});
app.use(express.json());app.use(express.static('public'));
setInterval(()=>{for(const [id,j] of jobs)if(Date.now()-j.time>20*60*1000)jobs.delete(id)},60000).unref();
app.post('/api/prepare',upload.single('file'),async(req,res)=>{
try{
if(!req.file||!['image/jpeg','image/png','image/webp'].includes(req.file.mimetype))return res.status(400).json({error:'Please upload a JPG, PNG, or WebP image under 15 MB.'});
const format=req.body.format||'jpeg',width=Number(req.body.width||0),quality=Number(req.body.quality||80);
if(!['jpeg','png','webp'].includes(format)||!Number.isInteger(width)||width<0||width>8000||!Number.isInteger(quality)||quality<30||quality>100)return res.status(400).json({error:'Invalid settings.'});
let image=sharp(req.file.buffer,{limitInputPixels:25000000}).rotate();
if(width)image=image.resize({width,withoutEnlargement:true});
const data=await image.toFormat(format,{quality}).toBuffer();
const id=crypto.randomUUID(),ext=format==='jpeg'?'jpg':format;
jobs.set(id,{data,time:Date.now(),filename:'fixed.'+ext,mime:'image/'+format});
res.json({id,bytes:data.length,filename:'fixed.'+ext,paymentEnabled:!!stripe});
}catch(e){res.status(400).json({error:'Could not process image: '+e.message})}
});
app.post('/api/checkout',async(req,res)=>{
const j=jobs.get(req.body.id);if(!j)return res.status(404).json({error:'File expired. Upload again.'});
if(!stripe)return res.status(503).json({error:'Payment is not configured yet.'});
try{
const base=process.env.BASE_URL;if(!base||!base.startsWith('https://'))return res.status(503).json({error:'BASE_URL must be configured with your HTTPS website address.'});
const s=await stripe.checkout.sessions.create({mode:'payment',line_items:[{price_data:{currency:'usd',unit_amount:299,product_data:{name:'Document Fixer image download'}},quantity:1}],success_url:base+'/?session_id={CHECKOUT_SESSION_ID}&job='+encodeURIComponent(req.body.id),cancel_url:base+'/?canceled=1',metadata:{jobId:req.body.id}});
res.json({url:s.url});
}catch(e){res.status(500).json({error:'Unable to start checkout.'})}
});
app.get('/api/download/:id',async(req,res)=>{
const j=jobs.get(req.params.id);if(!j)return res.status(404).send('File expired. Please upload again.');
if(!stripe)return res.status(503).send('Payments not configured.');
try{
const s=await stripe.checkout.sessions.retrieve(String(req.query.session_id||''));
if(s.payment_status!=='paid'||s.metadata?.jobId!==req.params.id)return res.status(403).send('Payment not verified.');
res.set('Cache-Control','no-store');res.set('Content-Type',j.mime);res.attachment(j.filename);res.send(j.data);
}catch(e){res.status(403).send('Payment verification failed.')}
});
app.use((e,req,res,next)=>res.status(400).json({error:e.message||'Upload failed.'}));
app.listen(process.env.PORT||3000,()=>console.log('Document Fixer ready'));
