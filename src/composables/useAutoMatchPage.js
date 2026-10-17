import {computed,nextTick,onUnmounted,ref,watch} from 'vue'
import {onHide,onLoad,onShow,onReady} from '@dcloudio/uni-app'
import {use_app_store,make_operation_id} from '@/stores/store.js'
import {use_write_loading} from './useWriteLoading.js'
import {MOTION} from '@/config/navigation.js'
export function use_auto_match_page(page) {
  const store=use_app_store(),frame=ref(null),match_id=ref(''),error=ref(''),modal=ref(''),draft=ref(null),query=ref(''),options_view=ref(false),navigating=ref(false)
  const {is_loading,run_with_loading,cancel_loading}=use_write_loading(),owner=store.session.account_id
  let visible=true,ready=false
  const range_end={age:'min',height:'min'}
  onLoad(o=>{match_id.value=String(o?.match_id||'');options_view.value=o?.view==='options';if(page==='preferences')draft.value=store.match_preferences?structuredCloneSafe(store.match_preferences):null})
  const c=computed(()=>store.match_presentation(match_id.value,draft.value,query.value)),busy=computed(()=>is_loading.value||navigating.value)
  const guard=computed(()=>c.value.error||(store.session.account_id!==owner?'Your session has ended. Please sign in again.':!['index','preferences','history'].includes(page)&&!c.value.match?'This match session is unavailable.':''))
  const go=async(url,kind='forward')=>{if(busy.value||!visible||!frame.value)return;error.value='';navigating.value=true;try{await frame.value[`navigate_${kind}`](url)}catch(cause){error.value=cause.message}finally{navigating.value=false}}
  const home=()=>go('/pages/home/index','relaunch')
  const back=async()=>{if(busy.value)return;if(page==='searching'||page==='paused'){modal.value='leaving';return}if(page==='found'){modal.value='found-leave';return}if(!['index','preferences','history'].includes(page)){await home();return}await go(page==='preferences'?c.value.active?.route||'/pages/auto-match/index':'/pages/home/index','back')}
  const follow=async()=>{if(!visible||!ready||!frame.value||busy.value||guard.value||['index','preferences','history'].includes(page))return;const row=c.value.match,route=c.value.route;if(options_view.value&&page==='no-match'&&['searching','paused','no_match'].includes(row.status))return;const target=route?.split('/').pop()?.split('?')[0];if(target&&target!==page){modal.value='';await go(route,'replace')}}
  watch(()=>[c.value.match?.status,c.value.error,store.session.account_id],follow)
  onReady(()=>{ready=true;follow()});onShow(()=>{visible=true;store.tick();nextTick(follow)})
  const write=async(action,destination)=>{if(busy.value||guard.value)return;error.value='';const result=await run_with_loading(scope=>action(scope));if(!visible||result.reason==='cancelled')return;if(!result.success){error.value=result.message;modal.value='';await follow();return result}modal.value='';if(destination)await go(typeof destination==='function'?destination(result.data):destination,'replace');else if(destination!==false)await follow();return result}
  const change=status=>write(()=>store.transition_match(match_id.value,status),status==='left'?'/pages/home/index':null)
  const pick=row=>{if(busy.value||!draft.value)return;if(row.key==='interest_ids'){const ids=draft.value.interest_ids;if(ids.includes(row.value))draft.value.interest_ids=ids.filter(i=>i!==row.value);else if(ids.length<5)draft.value.interest_ids=[...ids,row.value];else error.value='Choose up to five interests.'}else{draft.value[row.key]=row.value;if(row.key==='university'){query.value='';modal.value=''}}}
  const track=async(kind,event)=>{
    if(busy.value||!draft.value)return
    if(event.type==='keydown'){if(event.key==='Enter'&&kind!=='distance'){range_end[kind]=range_end[kind]==='min'?'max':'min';return}const increment=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;if(!increment)return;if(kind==='distance')draft.value.distance_max=Math.max(0,Math.min(100,draft.value.distance_max+increment));else{const upper=range_end[kind]==='max',key=kind+(upper?'_max':'_min'),limit=kind==='age'?[18,35]:[140,200];draft.value[key]=Math.max(upper?draft.value[kind+'_min']:limit[0],Math.min(upper?limit[1]:draft.value[kind+'_max'],draft.value[key]+increment))}return}
    const target=event.currentTarget,rect=await new Promise(resolve=>{if(target?.getBoundingClientRect)resolve(target.getBoundingClientRect());else uni.createSelectorQuery().select(`[data-range="${kind}"]`).boundingClientRect(resolve).exec()})
    if(!rect)return
    const x=event.clientX??event.touches?.[0]?.clientX??event.detail?.x??rect.left,ratio=Math.max(0,Math.min(1,(x-rect.left-uni.upx2px(38.168))/(rect.width-uni.upx2px(76.336))))
    if(kind==='distance')draft.value.distance_max=Math.round(ratio*100)
    else{const [min,max]=kind==='age'?[18,35]:[140,200],value=Math.round(min+(max-min)*ratio),low=`${kind}_min`,high=`${kind}_max`;if(Math.abs(value-draft.value[low])<=Math.abs(value-draft.value[high]))draft.value[low]=Math.min(value,draft.value[high]);else draft.value[high]=Math.max(value,draft.value[low])}
  }
  const action=async(name,event,row)=>{
    if(busy.value)return
    if(name==='closeSheet'||name==='stayInPool'||name==='standardMatch'){modal.value='';return}
    if(name==='goBack'){await back();return}
    if(name==='returnHome'){await home();return}
    if(name==='openPrefs'||name==='adjustPrefs'){await go('/pages/auto-match/preferences');return}
    if(name==='openUniPicker'){query.value='';modal.value='university';return}
    if(name==='openInterestsPicker'){modal.value='interests';return}
    if(name==='onUniSearch'){query.value=String(event.detail?.value??'');return}
    if(name==='clearInterests'){if(draft.value)draft.value.interest_ids=[];return}
    if(name==='pick'){pick(row);return}
    if(name==='onAgeTrack'||name==='onHeightTrack'||name==='onDistanceTrack'){await track(name==='onAgeTrack'?'age':name==='onHeightTrack'?'height':'distance',event);return}
    if(name==='savePrefs'){if(!draft.value)return;const patch=Object.fromEntries(Object.entries(draft.value).filter(([k])=>k!=='owner_user_id'));const result=await write(()=>store.update_match_preferences(patch));if(result?.success)await go('/pages/auto-match/index','back');return}
    if(name==='joinPool'){
      if(c.value.active){await go(store.matching_context(c.value.active.match_id).route,'replace');return}
      if(c.value.access_error){error.value=c.value.access_error;return}
      if(store.free_matches_remaining===0&&store.coin_balance<10){modal.value='insufficient-standard';return}
      await write(()=>store.start_match(make_operation_id('auto-match')),id=>`/pages/auto-match/searching?match_id=${encodeURIComponent(id)}`);return
    }
    if(name==='pauseQueue'){await change('paused');return}if(name==='resumeQueue'){await change('searching');return}
    if(name==='askLeave'){modal.value='leaving';return}if(name==='confirmLeave'){const result=await write(()=>store.transition_match(match_id.value,'left'),false);if(result?.success)await home();return}
    if(name==='openAmHelp'){modal.value='help';return}if(name==='openBoost'){modal.value=store.coin_balance<20?'insufficient':'boost';return}
    if(name==='confirmBoost'){if(!['searching','paused'].includes(c.value.match?.status)){await follow();return}await write(()=>store.save_draft('coin_spend',match_id.value,{kind:'priority_match',match_id:match_id.value,operation_id:make_operation_id('priority-match')}),id=>`/pages/coins/processing?return_context_id=${encodeURIComponent(id)}`);return}
    if(name==='showNoMatch'){await go(`/pages/auto-match/no-match?match_id=${encodeURIComponent(match_id.value)}&view=options`);return}
    if(name==='askLeaveMatch'){modal.value='found-leave';return}if(name==='passMatch'){await change('passed');return}
    if(name==='connectAsk'){modal.value='accepting';return}if(name==='confirmConnect'){await change('waiting');return}
    if(name==='cancelRequest'){modal.value='cancel';return}if(name==='confirmCancel'){const result=await write(()=>store.transition_match(match_id.value,'left'),false);if(result?.success)await home();return}
    if(name==='findAnother'){if(options_view.value&&c.value.active)await go(store.matching_context(c.value.active.match_id).route,'replace');else await go('/pages/auto-match/index','replace');return}
    if(name==='openLimitedProfile'||name==='viewProfile'){if(c.value.candidate)await go(`/pages/discover/profile?user_id=${encodeURIComponent(c.value.candidate.user_id)}`);return}
    if(name==='startChat'){const id=store.connection_by_user(c.value.candidate?.user_id)?.conversation_id;if(id)await go(`/pages/messages/chat?conversation_id=${encodeURIComponent(id)}`);else error.value='This conversation is unavailable. Return Home and try again.';return}
    if(name==='history'){await go(row.route);return}
    if(name==='getCoins'){const kind=modal.value==='insufficient-standard'?'match_entry':'match_priority';const result=await write(()=>store.save_draft('match_return',match_id.value||'entry',{kind,match_id:match_id.value||null}));if(result?.success)await go(`/pages/coins/index?return_context_id=${encodeURIComponent(result.data)}`);return}
  }
  onHide(()=>{visible=false;modal.value='';cancel_loading();navigating.value=false})
  onUnmounted(()=>{visible=false;ready=false;cancel_loading()})
  const motion_style={'--match-pulse-duration':`${MOTION.match_pulse}ms`,'--match-pulse-delay':`${MOTION.match_pulse_delay}ms`,'--match-connected-duration':`${MOTION.match_connected}ms`}
  return{store,frame,match_id,c,error,modal,draft,query,busy,is_loading,guard,action,follow,motion_style}
}
const structuredCloneSafe=value=>JSON.parse(JSON.stringify(value))
