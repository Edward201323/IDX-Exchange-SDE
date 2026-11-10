import PropertyImageCarousel from './PropertyImageCarousel';
import { numberLabel, priceLabel } from '../utils/property';

export default function PropertyCard({ property }) {
  const address = property.L_Address || 'Address unavailable';
  const location = [property.L_City, property.L_State, property.L_Zip].filter(Boolean).join(', ');
  return (
    <article className="property-card" aria-label={address}>
      <PropertyImageCarousel key={JSON.stringify([property.L_ListingID, property.L_Photos])} photos={property.L_Photos} address={address} />
      <div className="property-body">
        <p className="property-price">{priceLabel(property.L_SystemPrice)}</p>
        <h3>{address}</h3>
        <p className="property-location">{location || 'Location unavailable'}</p>
        <dl className="property-facts">
          <div><dt>Beds</dt><dd>{numberLabel(property.L_Keyword2)}</dd></div>
          <div><dt>Baths</dt><dd>{numberLabel(property.LM_Dec_3)}</dd></div>
          <div><dt>Sq ft</dt><dd>{numberLabel(property.LM_Int2_3)}</dd></div>
        </dl>
      </div>
    </article>
  );
}
