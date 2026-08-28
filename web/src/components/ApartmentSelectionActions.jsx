import SelectionActions, { SelectionBadges as SelectionBadgesBase } from "./SelectionActions.jsx";

export default function ApartmentSelectionActions(props) {
  return <SelectionActions {...props} item={props.apartment || props.item} />;
}

export function SelectionBadges({ apartment, item }) {
  return <SelectionBadgesBase item={item || apartment} />;
}
