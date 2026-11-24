# Spatial audio

Optional and initially off for each 3D view. Server room policy can prohibit it. The adapter inserts presentation-only gain/pan into existing remote microphone tracks with known 3D positions; ordinary voice participants retain full ordinary playback.

Distance attenuation stays at 1 within 2 m, linearly reaches 0.15 at 18 m and remains there. Stereo is the camera-relative horizontal projection divided by 8 m, clamped to [-1,1]. AudioParam changes use 80 ms smoothing. No microphone capture changes. Existing local mute/server mute/deafen and output/user/connection volume remain authoritative outside the presentation nodes. Shared-screen audio is unchanged.

Updates follow the 10 Hz room command loop. Disabling restores ordinary plugins on the next loop (normally <=100 ms). A network/voice/render failure restores ordinary audio; unmount does so synchronously in cleanup. The shared voice AudioContext remains owned by the voice engine; 3D never closes it. Autoplay/resume policy stays in its existing user-gesture handler. If WebAudio context creation is unavailable, spatial nodes are not installed and ordinary playback continues.

The curve/pan formula is unit tested. Acoustic comfort, actual stereo direction on different headsets and full mute/deafen listening regressions remain manual release gates. This is distance/pan presentation, not acoustic occlusion, HRTF room simulation or positional microphone capture.
