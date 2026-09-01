import { renderBuildingText, splitIntoBullets } from "../../lib/buildingText.js";

export default function BuildingBulletList({ text }) {
  const bullets = splitIntoBullets(text);
  if (!bullets.length) return null;

  return (
    <ul className="building-bullet-list">
      {bullets.map((bullet, index) => (
        <li key={index}>
          {renderBuildingText(bullet).map((node) =>
            node.type === "strong" ? <strong key={node.key}>{node.text}</strong> : node.text,
          )}
        </li>
      ))}
    </ul>
  );
}
