// Source picker catalog, plus explicitly user-authorized generated region distances.
// Not GPS, live presence, travel distance or a claim about a person's current position.
export const MATCH_UNIVERSITIES=['All','My university','Nearby universities','Any supported university','HKUST','HKU','CUHK','PolyU','CityU','HKBU','EdUHK','Stanford University','UC Berkeley','UCLA']
export const MATCH_MAJORS=[['All',''],['Business','💼'],['Computer Science','💻'],['Engineering','⚙️'],['Medicine','🩺'],['Finance','💰'],['Sciences','🔬'],['Data Science','📊'],['Economics','📈'],['Psychology','🧠'],['Law','⚖️'],['Education','📚'],['Arts','🎨'],['Nursing','💊'],['Marketing','📣'],['Architecture','🏛️'],['Biology','🧬'],['Communications','🎙️'],['Political Science','🗳️'],['Accounting','🧾']]
export const MATCH_MBTI=['All','INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']
export const MATCH_RELIGION=['All','Prefer Not to Say','Non-Religious','Atheist','Christian','Catholic','Islam','Taoism','Buddhism','Hinduism']
export const MATCH_DRINKING=['All','Never','Occasionally','Socially','Regularly']
const areas=[['HKUST','hong_kong',20,0],['HKU','hong_kong',0,0],['CUHK','hong_kong',10,20],['PolyU','hong_kong',8,4],['CityU','hong_kong',8,10],['HKBU','hong_kong',9,11],['EdUHK','hong_kong',14,28],['Stanford','bay_area',0,0],['UC Berkeley','bay_area',40,55],['UCLA','los_angeles',0,0]]
export const campus_key=value=>value==='Stanford University'?'Stanford':String(value||'')
export const generated_match_distances=()=>areas.flatMap(([university_a,region_a,x,y],i)=>areas.slice(i).map(([university_b,region_b,a,b])=>({area_pair_id:`${university_a}:${university_b}`,university_a,university_b,distance_km:region_a===region_b?Math.round(Math.hypot(x-a,y-b)):20000,source:'generated_campus_region'})))
export function matching_distance(data,me,person){
  const a=campus_key(me.university),b=campus_key(person.university)
  if(a&&a===b)return 0
  return data.match_distances?.find(d=>d.university_a===a&&d.university_b===b||d.university_a===b&&d.university_b===a)?.distance_km??null
}
