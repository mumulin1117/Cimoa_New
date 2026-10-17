import {create_seed} from '../../src/stores/seed.js'
import {ensure_account_defaults} from '../../src/stores/accountDefaults.js'
// Isolated QA fixture only. Never imported by the production application.
export function auto_match_scenario(now=Date.now()) {
  const data=create_seed(now)
  data.match_sessions=[]
  for(const person of data.users)person.discoverable=person.user_id==='user_zane'||person.user_id==='user_cimoa'
  data.accounts.push({...data.accounts[0],account_id:'account_match_peer',user_id:'user_zane',email:'zane@cimoa.test'})
  ensure_account_defaults(data,'user_zane')
  return data
}
