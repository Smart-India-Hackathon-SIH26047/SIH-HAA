const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Write valid SVG icons
const svgContent = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#3457D5"/>
  <text x="50%" y="54%" font-family="Inter, Arial, sans-serif" font-size="${size * 0.55}" font-weight="bold" fill="#FAFAF8" text-anchor="middle" dominant-baseline="middle">S</text>
</svg>`;

// Standard base64 PNG fallback (192x192 blue icon)
const base64Png = 'iVBORw0KGgoAAAANSU5EUgAAAMAAAADACAYAAABS3GwHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAADh0RVh0U29mdHdhcmUAbWF0cGxvdGxpYiB2ZXJzaW9uMy41LjEsIGh0dHA6Ly9tYXRwbG90bGliLm9yZy87qK1CAAADhUlEQVR4nO3BMQEAAADCoPVPbQhfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwK8BPAABz0n7sgAAAABJRU5ErkJggg==';

const pngBuffer = Buffer.from(base64Png, 'base64');

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon-192.svg'), svgContent(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.svg'), svgContent(512));

console.log("PWA icon files created successfully in public/icons/");
