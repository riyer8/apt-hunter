import SelectionActions, { SelectionBadges as SelectionBadgesBase } from "../common/SelectionActions.jsx";

export default function ApartmentSelectionActions(props) {
  return <SelectionActions {...props} item={props.apartment || props.item} variant={props.variant} />;
}

export function SelectionBadges({ apartment, item }) {
  return <SelectionBadgesBase item={item || apartment} />;
}
