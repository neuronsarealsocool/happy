import '@expo/metro-runtime';
import React from 'react';
import { ExpoRoot } from 'expo-router';
import { AppRegistry } from 'react-native';
import { Head } from 'expo-router/build/head';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import './sources/polyfills/screenOrientation';
import './sources/unistyles';
import {
  ANDROID_CHAT_HEAD_REPLY_TASK,
  runAndroidChatHeadReplyTask,
} from './sources/utils/androidChatHeadReplyTask';

AppRegistry.registerHeadlessTask(
  ANDROID_CHAT_HEAD_REPLY_TASK,
  () => runAndroidChatHeadReplyTask,
);

const appContext = require.context(
  './sources/app',
  true,
  /^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*(?:\.ios|\.web)?\.[tj]sx?$/,
  'sync'
);

function App() {
  return React.createElement(
    Head.Provider,
    null,
    React.createElement(ExpoRoot, { context: appContext })
  );
}

renderRootComponent(App);
