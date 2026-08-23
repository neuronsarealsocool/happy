/**
 * @more-tech/react-native-libsodium passes NODE_MODULES_DIR from Gradle with
 * Windows backslashes. CMake treats backslashes as escapes inside quoted
 * strings, so paths like D:\hh\node_modules fail with "Invalid character
 * escape '\h'". Normalize the path before it is interpolated.
 */
const fs = require('fs');
const path = require('path');

const nodeModulesRoots = [
    path.resolve(__dirname, '..', 'node_modules'),
    path.resolve(__dirname, '..', 'packages/happy-app/node_modules'),
];

let patched = 0;

for (const nodeModulesRoot of nodeModulesRoots) {
    const cmakeFile = path.join(
        nodeModulesRoot,
        '@more-tech/react-native-libsodium/android/CMakeLists.txt'
    );
    if (!fs.existsSync(cmakeFile)) continue;

    let content = fs.readFileSync(cmakeFile, 'utf8');
    const original = content;

    if (!content.includes('NODE_MODULES_DIR_CMAKE')) {
        content = content.replace(
            'set (CMAKE_CXX_STANDARD 20)\n',
            'set (CMAKE_CXX_STANDARD 20)\nfile(TO_CMAKE_PATH "${NODE_MODULES_DIR}" NODE_MODULES_DIR_CMAKE)\n'
        );
    }

    content = content.replaceAll('${NODE_MODULES_DIR}/', '${NODE_MODULES_DIR_CMAKE}/');

    if (content !== original) {
        fs.writeFileSync(cmakeFile, content, 'utf8');
        patched++;
    }
}

if (patched > 0) {
    console.log(`[patch] Fixed react-native-libsodium CMake Windows paths (${patched} file(s))`);
}
