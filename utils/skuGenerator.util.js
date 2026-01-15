export const generateSKU = ({productName,size})=>{
    const base = productName.replace(/[^a-zA-Z0-9]/g,"").toUpperCase();
    return `${base}-${size}`;
}