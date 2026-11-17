/* Local classification of OCR lines. Candidate lists let the visitor correct ambiguous layouts. */
function parseCard(data) {
  const text = typeof data === 'string' ? data : data.text;
  const sourceLines = typeof data === 'string' ? [] : data.lines || [];
  const lines = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const job = /\b(sales|manager|director|president|engineer|founder|owner|ceo|cto|officer|marketing|executive|consultant|representative|specialist|export|department|supervisor)\b/i;
  const business = /\b(ltd|limited|inc|llc|gmbh|corp|corporation|company|machinery|equipment|industries|industrial|trading|technologies|technology|solutions|group|international|holdings|rental|rentals|construction|manufacturing|co)\b/i;
  const address = /\b(street|road|avenue|drive|lane|suite|floor|building|postcode|postal|office|park|district|boulevard|highway|address)\b/i;
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phones = lines.filter(line => !/\bfax\b/i.test(line)).sort((a,b) => Number(/whats\s*app|mobile|cell|mob\b/i.test(b))-Number(/whats\s*app|mobile|cell|mob\b/i.test(a))).flatMap(line => line.match(/\+?\d[\d ().-]{7,}\d/g) || []).filter(value => value.replace(/\D/g,'').length >= 8);
  const regions = new Intl.DisplayNames(['en'], {type:'region'});
  const countryNames = [];
  for(let a=65;a<=90;a++) for(let b=65;b<=90;b++) {
    const code=String.fromCharCode(a,b), name=regions.of(code);
    if(name && name!==code) countryNames.push(name);
  }
  countryNames.push('United States of America','Turkey','South Korea','UAE','USA','UK');
  const countries = countryNames.filter(name => new RegExp('(?:^|[^\\p{L}])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^\\p{L}])','iu').test(text));
  const countrySet = new Set(countries.map(name=>name.toLowerCase()));
  const emailName = email.split('@')[0].toLowerCase().replace(/[^a-z]/g,'');
  const domain = email.split('@')[1]?.split('.')[0]?.toLowerCase() || '';
  const candidates = lines.map((original,index) => {
    const explicitName = /^(?:name|contact|姓名)\s*[:：]/i.test(original);
    const value = original.replace(/^(?:name|contact|company|姓名|公司)\s*[:：]\s*/i,'').replace(/^(?:mr|mrs|ms|dr)\.?\s+/i,'').trim();
    const geometry=sourceLines.find(line=>line.text?.trim()===original);
    const height=geometry?.bbox ? geometry.bbox.y1-geometry.bbox.y0 : 0;
    const words=value.split(/\s+/);
    const plainName=/^[\p{L}][\p{L}\p{M}\s.'’\-]+$/u.test(value) && words.length>=2 && words.length<=5;
    const excluded = business.test(value)||job.test(value)||address.test(value)||countrySet.has(value.toLowerCase())||/www\.|https?:|@|\d/.test(value);
    let nameScore=plainName&&!excluded ? 2 : -100;
    if(explicitName) nameScore+=10;
    if(!excluded && job.test(lines[index+1]||'')) nameScore+=4;
    if(!excluded && job.test(lines[index-1]||'')) nameScore+=2;
    const parts=words.map(word=>word.toLowerCase().replace(/[^a-z]/g,'')).filter(word=>word.length>1);
    if(plainName && !excluded && parts.length>=2 && parts.every(part=>emailName.includes(part))) nameScore+=5;
    if(plainName && !excluded && geometry?.confidence>=85) nameScore+=1;
    let companyScore=business.test(value)&&!job.test(value)?6:0;
    if (companyScore && /\b(ltd|limited|inc|llc|gmbh|corp|corporation)\.?$/i.test(value)) companyScore+=3;
    if(/^(?:company|公司)\s*[:：]/i.test(original))companyScore+=10;
    if(domain.length>3 && value.toLowerCase().replace(/[^a-z]/g,'').includes(domain) && !/@|www\.|https?:/i.test(value))companyScore+=4;
    return {value,index,height,nameScore,companyScore};
  });
  const names=candidates.filter(item=>item.nameScore>=2).sort((a,b)=>b.nameScore-a.nameScore||b.height-a.height);
  const companies=candidates.filter(item=>item.companyScore>0).sort((a,b)=>b.companyScore-a.companyScore||b.height-a.height);
  const confidentName=names[0] && names[0].nameScore>=5 && (!names[1]||names[0].nameScore-names[1].nameScore>=2);
  return {
    fields:{name:confidentName?names[0].value:'',company:companies[0]?.value||'',email,whatsapp:phones[0]||'',country:countries[0]||''},
    candidates:{name:[...new Set(names.map(item=>item.value))],company:[...new Set([...companies.map(item=>item.value),...lines.filter(line=>!/@|\d|www\.|https?:/i.test(line)&&!job.test(line)&&!countrySet.has(line.toLowerCase()))])],country:[...new Set(countries)],whatsapp:[...new Set(phones)]},
    lines
  };
}
if(typeof module!=='undefined') module.exports={parseCard};
