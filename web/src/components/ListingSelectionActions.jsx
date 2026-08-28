import SelectionActions, { SelectionBadges } from "./SelectionActions.jsx";

export default function ListingSelectionActions(props) {
  return <SelectionActions {...props} item={props.listing || props.item} />;
}

export { SelectionBadges as ListingSelectionBadges };
