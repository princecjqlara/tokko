# System Message Sending Capacity

## Overview
The bulk messaging system is designed to handle messages at scale with multiple protection mechanisms and automatic optimization.

---

## Message Limits

### **Immediate Send (Synchronous)**
- **Limit:** Up to **100 contacts**
- **Processing:** Sent immediately within the request
- **Timeout:** 5 minutes (300 seconds) on Vercel Pro
- **Speed:** ~36 messages per minute per page
- **Best for:** Small to medium batches

### **Background Jobs (Asynchronous)**
- **Limit:** **100+ contacts** (automatically triggered)
- **Processing:** Processed in background, no timeout limit
- **Resumable:** Yes, can resume if interrupted
- **Progress Tracking:** Real-time updates via UI
- **Best for:** Large batches, thousands of contacts

---

## Technical Specifications

### **Rate Limiting**
```typescript
// Facebook API Rate Limits
- ~200 calls per hour per page
- 100ms delay between messages
- ~36 messages per minute maximum
- ~600 messages per hour per page
```

### **Batch Processing**
```typescript
// Automatic batch handling
if (contacts.length > 100) {
    // Create background job
    // Process asynchronously
    // No timeout restrictions
} else {
    // Send immediately
    // 5 minute timeout
}
```

### **Database Query Limits**
```typescript
// Supabase IN() query chunking
const CONTACT_FETCH_CHUNK = 200;
// Queries split into chunks of 200 contacts
// No limit on total contacts
```

---

## Capacity by Scenario

### **Single Page**
| Scenario | Contacts | Method | Time Estimate |
|----------|----------|--------|---------------|
| Small batch | 1-100 | Immediate | 3-5 minutes |
| Medium batch | 100-500 | Background | 15-25 minutes |
| Large batch | 500-1000 | Background | 30-50 minutes |
| Very large | 1000+ | Background | 1-2 hours |

### **Multiple Pages**
- **No hard limit** - System processes all pages sequentially
- Each page has independent rate limits
- Total capacity = (Number of pages × 600 messages/hour)
- Example: 10 pages = 6,000 messages per hour

---

## System Constraints

### **Vercel Limits (Hosting)**
- **Function Timeout:** 300 seconds (5 minutes) on Pro plan
- **Solution:** Background jobs for batches >100
- **Memory:** Sufficient for processing thousands of contacts

### **Facebook API Limits**
- **Rate Limit:** ~200 API calls per hour per page
- **Solution:** 100ms delay between messages
- **Daily Limit:** No hard limit, but rate-limited

### **Database Limits (Supabase)**
- **Query Size:** 200 contacts per query (chunked)
- **Storage:** Unlimited contacts
- **Concurrent Jobs:** Multiple jobs can run simultaneously

---

## Practical Capacity

### **Realistic Throughput**

**Per Hour:**
- Single page: ~600 messages
- 5 pages: ~3,000 messages
- 10 pages: ~6,000 messages
- 20 pages: ~12,000 messages

**Per Day:**
- Single page: ~14,400 messages
- 5 pages: ~72,000 messages
- 10 pages: ~144,000 messages
- 20 pages: ~288,000 messages

### **Peak Performance**
With optimal configuration:
- **Maximum:** Unlimited (background jobs)
- **Recommended:** 10,000-50,000 messages per day
- **Sustainable:** 5,000-10,000 messages per day

---

## Message Types

### **Text Messages**
- **Speed:** ~36 per minute
- **Limit:** No limit on message length (Facebook limit: 2000 chars)
- **Personalization:** Supports {FirstName} placeholder

### **Media Messages**
- **Speed:** ~20-30 per minute (slower due to media upload)
- **File Size:** Max 25MB per file
- **Types:** Images, videos, audio, documents
- **Process:** Upload once, send to all contacts

### **Scheduled Messages**
- **Limit:** Unlimited scheduled messages
- **Storage:** Database-backed
- **Processing:** Cron job checks every minute
- **Accuracy:** Within 1 minute of scheduled time

---

## Optimization Features

### **Automatic Optimization**
1. **Batch Detection:** Auto-switches to background jobs at 100+ contacts
2. **Chunked Queries:** Splits large contact lists into manageable chunks
3. **Rate Limiting:** Built-in delays to respect Facebook limits
4. **Resume Support:** Jobs can resume if interrupted
5. **Duplicate Prevention:** Request ID tracking prevents duplicates

### **Performance Features**
- **Concurrent Processing:** Multiple pages processed in parallel
- **Progress Tracking:** Real-time updates for background jobs
- **Error Recovery:** Failed messages tracked, can be retried
- **Timeout Protection:** Automatic background job creation

---

## Recommendations

### **For Best Performance:**

1. **Small Batches (< 100 contacts)**
   - Use immediate send
   - Fast, real-time feedback
   - No background job overhead

2. **Medium Batches (100-1000 contacts)**
   - Automatic background job
   - Monitor progress in UI
   - Can cancel if needed

3. **Large Batches (1000+ contacts)**
   - Use background jobs
   - Schedule during off-peak hours
   - Monitor job status
   - Consider splitting across multiple days

4. **Very Large Campaigns (10,000+ contacts)**
   - Split into multiple batches
   - Spread across multiple days
   - Use scheduling feature
   - Monitor Facebook rate limits

---

## Limitations & Considerations

### **Hard Limits:**
- ❌ No system-imposed message limit
- ✅ Limited by Facebook API rate limits
- ✅ Limited by Vercel function timeout (for immediate sends)

### **Soft Limits:**
- ⚠️ Recommended: 10,000 messages per day
- ⚠️ Facebook may flag excessive sending
- ⚠️ Monitor delivery rates and engagement

### **Best Practices:**
- ✅ Test with small batches first
- ✅ Monitor error rates
- ✅ Respect user preferences
- ✅ Use scheduling for large campaigns
- ✅ Keep messages relevant and valuable

---

## Summary

**The system can theoretically send unlimited messages**, but practical limits are:

- **Immediate:** 100 contacts per request
- **Background:** Unlimited (thousands to millions)
- **Hourly Rate:** ~600 messages per page
- **Daily Capacity:** 10,000-50,000 messages (recommended)
- **Maximum:** Limited only by Facebook API rate limits

**Key Takeaway:** The system is designed to scale from small batches to enterprise-level campaigns with automatic optimization and no hard limits.
