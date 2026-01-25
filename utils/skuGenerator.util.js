export const generateSKU = ({slug,color,size})=>{
    const colorCode = color.trim().replace(/[^a-zA-Z]/g,"").toUpperCase();
    return `${slug.toUpperCase()}-${colorCode}-${size}`;
};