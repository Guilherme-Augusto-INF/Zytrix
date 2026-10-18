import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveViewTracker } from '../assets/js/analytics-events.js';
import { getStreamingEmbed } from '../assets/js/streaming.js';
import { readFileSync } from 'node:fs';

const live = {status:'live', playbackURL:'https://www.twitch.tv/somechannel', id:'private-stream-id', streamerUid:'private-user-id', title:'Private title'};
test('view_live requires a loaded and valid live, and is reported once', () => {
    const events = [];
    const track = createLiveViewTracker((event, params) => { events.push({event, params}); return true; }, getStreamingEmbed);
    assert.equal(track({ ...live, status:'offline'}),false);
    assert.equal(track({...live,playbackURL:'https://malicious.example/stream'}),false);
    assert.equal(events.length, 0);
    assert.equal(track(live),true);
    assert.equal(track(live),false);
    assert.deepEqual(events,[{event:'view_live',params:{stream_platform:'twitch'}}]);
});
test('view_live does not fire before opt-in, and succeeds after opt-in', () => {
    let consent=false;
    const events=[];
    const track=createLiveViewTracker((name,params) => {
        if(!consent)return false;
        events.push({name,params});return true;
    },getStreamingEmbed);
    assert.equal(track(live),false);
    consent=true;
    assert.equal(track(live),true);
    assert.deepEqual(events,[{name:'view_live',params:{stream_platform:'twitch'}}]);
});
test('supported source labels do not include personally identifying values', () => {
    for (const [url,expected] of [
        ['https://www.twitch.tv/somechannel','twitch'],
        ['https://kick.com/somechannel','kick'],
        ['https://www.youtube.com/watch?v=ABCDEFGHIJK','youtube']
    ]) {
        const events=[];
        const track=createLiveViewTracker((name,params)=> {events.push({name,...params});return true;},getStreamingEmbed);
        assert.equal(track({status:'live',playbackURL:url,id:'secret',title:'user title'}),true);
        assert.deepEqual(events,[{name:'view_live',stream_platform:expected}]);
    }
});
test('consent bridge accepts only whitelisted dataLayer events', () => {
    const consentScript = readFileSync('assets/js/gtm-consent.js','utf8');
    assert.match(consentScript, /window\.zytrixTrackEvent/);
    assert.match(consentScript, /readChoice\(\) !== 'accepted'/);
    assert.match(consentScript, /name !== 'view_live'/);
    assert.match(consentScript, /zytrix:analytics-consent-granted/);
    const liveScript=readFileSync('assets/js/live.js','utf8');
    assert.match(liveScript, /createLiveViewTracker/);
    assert.match(liveScript, /maybeTrackLiveView\(stream\)/);
});
