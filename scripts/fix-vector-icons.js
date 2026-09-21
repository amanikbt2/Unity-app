const fs = require('fs');
const path = require('path');

const fontsDir = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'vector-icons',
  'build',
  'vendor',
  'react-native-vector-icons',
  'Fonts'
);

const fontNames = [
  'AntDesign.ttf',
  'Entypo.ttf',
  'EvilIcons.ttf',
  'Feather.ttf',
  'FontAwesome.ttf',
  'FontAwesome5_Brands.ttf',
  'FontAwesome5_Regular.ttf',
  'FontAwesome5_Solid.ttf',
  'FontAwesome6_Brands.ttf',
  'FontAwesome6_Regular.ttf',
  'FontAwesome6_Solid.ttf',
  'Fontisto.ttf',
  'Foundation.ttf',
  'Ionicons.ttf',
  'MaterialCommunityIcons.ttf',
  'MaterialIcons.ttf',
  'Octicons.ttf',
  'SimpleLineIcons.ttf',
  'Zocial.ttf'
];

if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

fontNames.forEach((font) => {
  const filePath = path.join(fontsDir, font);
  if (!fs.existsSync(filePath)) {
    // Write a dummy minimal TTF buffer or empty file so Metro can resolve it
    fs.writeFileSync(filePath, Buffer.from([]));
    console.log(`Created font placeholder: ${font}`);
  }
});

console.log('Vector icons font check complete.');
