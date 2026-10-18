/**
 * One event per valid live page view; a live page open is not proof that
 * playback started in the third-party Twitch/Kick/YouTube iframe.
 * Do not send stream IDs, URLs, account IDs, titles or creator names to GA4.
 */
export function createLiveViewTracker(track, getEmbed) {
    let reported = false;
    return function trackLiveView(stream) {
        if (reported || stream?.status !== 'live' || !stream.playbackURL)
            return false;
        const player = getEmbed(stream.playbackURL);
        if (!player || !['twitch', 'kick', 'youtube'].includes(player.platform))
            return false;
        // The consent manager returns false until analytics is explicitly accepted.
        if (track('view_live', { stream_platform: player.platform }) !== true)
            return false;
        reported = true;
        return true;
    };
}
